import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(request: NextRequest) {
  try {
    // Get and verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    // Prevent admins from creating leave requests
    const roleRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    const role = roleRes.rows?.[0]?.role
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'Admins cannot submit leave requests' },
        { status: 403 }
      )
    }


    const body = await request.json()
    const { startDate, endDate, reason } = body

    // Validate required fields
    if (!startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'Start date, end date, and reason are required' },
        { status: 400 }
      )
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (start < today) {
      return NextResponse.json(
        { error: 'Start date cannot be in the past' },
        { status: 400 }
      )
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 }
      )
    }

    // Enforce 2026 calendar year only
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()
    if (startYear !== 2026 || endYear !== 2026) {
      return NextResponse.json(
        { error: 'Leave requests are only allowed for the year 2026' },
        { status: 400 }
      )
    }

    // Enforce minimum 14 consecutive days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff < 14) {
      return NextResponse.json(
        { error: 'Minimum booking is 14 consecutive days' },
        { status: 400 }
      )
    }

    // Load settings and holidays to compute working days
    const settingsRes = await db.query(`SELECT excluded_weekdays FROM public.leave_settings WHERE id = 1`)
    const excludedWeekdays: number[] = settingsRes.rows?.[0]?.excluded_weekdays || []

    const holidaysRes = await db.query(
      `SELECT holiday_date::text AS date
       FROM public.holidays
       WHERE holiday_date BETWEEN $1::date AND $2::date`,
      [startDate, endDate]
    )
    const holidaySet = new Set<string>(holidaysRes.rows.map((r: any) => r.date))

    // Calculate number of days excluding configured weekdays and holidays
    const days = calculateWorkingDays(start, end, excludedWeekdays, holidaySet)

    if (days <= 0) {
      return NextResponse.json(
        { error: 'Leave request must include at least one working day' },
        { status: 400 }
      )
    }

    // Check if user has enough leave balance
    const currentYear = new Date().getFullYear()
    const balanceResult = await db.query(`
      SELECT days_allocated, days_used
      FROM leave_balances
      WHERE user_id = $1 AND year = $2
    `, [decoded.userId, currentYear])

    if (balanceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave balance not found' },
        { status: 404 }
      )
    }

    const balance = balanceResult.rows[0]
    const remainingDays = balance.days_allocated - balance.days_used

    if (days > remainingDays) {
      return NextResponse.json(
        { error: `Insufficient leave balance. You have ${remainingDays} days remaining, but requested ${days} days.` },
        { status: 400 }
      )
    }

    // Check for overlapping leave requests
    const overlapResult = await db.query(`
      SELECT id FROM leave_requests
      WHERE user_id = $1
        AND status IN ('pending', 'approved')
        AND (
          (start_date <= $2 AND end_date >= $2) OR
          (start_date <= $3 AND end_date >= $3) OR
          (start_date >= $2 AND end_date <= $3)
        )
    `, [decoded.userId, startDate, endDate])

    if (overlapResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'You already have a leave request for overlapping dates' },
        { status: 400 }
      )
    }

    // Get user's position
    const positionRes = await db.query('SELECT position FROM profiles WHERE id = $1', [decoded.userId])
    const userPosition = positionRes.rows?.[0]?.position

    if (!userPosition) {
      return NextResponse.json(
        { error: 'User position not set. Please contact administrator.' },
        { status: 400 }
      )
    }

    // Check position limits for each day in the requested range (max 5 captains, max 5 first officers per day)
    const positionCheckResult = await checkPositionLimits(startDate, endDate, userPosition, decoded.userId)
    if (!positionCheckResult.allowed) {
      return NextResponse.json(
        { error: positionCheckResult.error },
        { status: 400 }
      )
    }

    // Create the leave request
    const result = await db.query(`
      INSERT INTO leave_requests (
        user_id, start_date, end_date, days, reason, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [decoded.userId, startDate, endDate, days, reason])

    const leaveRequest = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Leave request submitted successfully',
      leaveRequest: {
        id: leaveRequest.id,
        start_date: leaveRequest.start_date,
        end_date: leaveRequest.end_date,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        status: leaveRequest.status,
        created_at: leaveRequest.created_at
      }
    })
  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    )
  }
}

// Helper function to calculate working days - leave runs 7 days/week, only exclude holidays
function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  excludedWeekdays: number[] = [],
  holidaySet: Set<string> = new Set()
): number {
  // Work in UTC to avoid timezone-related off-by-one calculations
  const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
  const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))

  let count = 0
  const current = new Date(startUTC)

  while (current.getTime() <= endUTC.getTime()) {
    const dateString = current.toISOString().split('T')[0]
    // Count all days except holidays (leave runs 7 days/week)
    if (!holidaySet.has(dateString)) {
      count++
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return count
}

// Helper function to check position limits (max 5 total employees per day)
async function checkPositionLimits(
  startDate: string,
  endDate: string,
  userPosition: 'captain' | 'first_officer',
  userId: string
): Promise<{ allowed: boolean; error?: string }> {
  // Get all approved leave requests that overlap with the requested dates
  const result = await db.query(`
    SELECT lr.start_date, lr.end_date, p.position
    FROM leave_requests lr
    JOIN profiles p ON lr.user_id = p.id
    WHERE lr.status = 'approved'
      AND lr.user_id != $1
      AND lr.start_date <= $3::date
      AND lr.end_date >= $2::date
      AND p.position IS NOT NULL
  `, [userId, startDate, endDate])

  // Build a map of date -> total count
  const countByDate: Record<string, number> = {}

  for (const row of result.rows) {
    const leaveStart = new Date(row.start_date)
    const leaveEnd = new Date(row.end_date)

    // Iterate through each day of this leave request
    const current = new Date(leaveStart)
    while (current <= leaveEnd) {
      const dateStr = current.toISOString().split('T')[0]
      countByDate[dateStr] = (countByDate[dateStr] || 0) + 1
      current.setDate(current.getDate() + 1)
    }
  }

  // Check each day in the requested range - max 5 total employees per day
  const reqStart = new Date(startDate)
  const reqEnd = new Date(endDate)
  const current = new Date(reqStart)

  while (current <= reqEnd) {
    const dateStr = current.toISOString().split('T')[0]
    const count = countByDate[dateStr] || 0

    if (count >= 5) {
      return {
        allowed: false,
        error: `Maximum of 5 employees already on leave on ${dateStr}. Please select different dates.`
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return { allowed: true }
}
