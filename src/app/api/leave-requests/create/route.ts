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

// Helper function to calculate working days excluding configured weekdays and holidays
function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  excludedWeekdays: number[] = [],
  holidaySet: Set<string> = new Set()
): number {
  // Work in UTC to avoid timezone-related off-by-one and wrong weekday calculations
  const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
  const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))

  let count = 0
  const current = new Date(startUTC)

  while (current.getTime() <= endUTC.getTime()) {
    const dayOfWeek = current.getUTCDay() // 0=Sun..6=Sat (UTC)
    const dateString = current.toISOString().split('T')[0]
    if (!excludedWeekdays.includes(dayOfWeek) && !holidaySet.has(dateString)) {
      count++
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return count
}
