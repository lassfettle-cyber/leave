import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // Check if user is admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, startDate, endDate, reason } = body

    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ error: 'userId, startDate, and endDate are required' }, { status: 400 })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before or equal to end date' }, { status: 400 })
    }

    // Enforce 2026 calendar year only
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()
    if (startYear !== 2026 || endYear !== 2026) {
      return NextResponse.json({ error: 'Leave requests are only allowed for the year 2026' }, { status: 400 })
    }

    // Check if user exists and get position
    const userCheck = await db.query('SELECT id, first_name, last_name, position FROM profiles WHERE id = $1', [userId])
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userPosition = userCheck.rows[0].position
    if (!userPosition) {
      return NextResponse.json({ error: 'User position not set. Please contact administrator.' }, { status: 400 })
    }

    // Get leave settings (excluded weekdays and holidays)
    const settingsRes = await db.query('SELECT excluded_weekdays FROM leave_settings WHERE id = 1')
    const excludedWeekdays: number[] = settingsRes.rows[0]?.excluded_weekdays || []

    const holidaysRes = await db.query(
      `SELECT holiday_date::text AS date FROM holidays WHERE holiday_date BETWEEN $1::date AND $2::date`,
      [startDate, endDate]
    )
    const holidaySet = new Set<string>(holidaysRes.rows.map((r: any) => r.date))

    // Calculate working days
    const workingDays = calculateWorkingDays(start, end, excludedWeekdays, holidaySet)

    if (workingDays === 0) {
      return NextResponse.json({ error: 'Leave request must include at least one working day' }, { status: 400 })
    }

    // Check user's leave balance
    const currentYear = new Date().getFullYear()
    const balanceRes = await db.query(
      'SELECT days_allocated, days_used FROM leave_balances WHERE user_id = $1 AND year = $2',
      [userId, currentYear]
    )

    if (balanceRes.rows.length === 0) {
      return NextResponse.json({ error: 'User has no leave allocation for this year' }, { status: 400 })
    }

    const balance = balanceRes.rows[0]
    const remainingDays = balance.days_allocated - balance.days_used

    if (workingDays > remainingDays) {
      return NextResponse.json({
        error: `Insufficient leave balance. User has ${remainingDays} days remaining, but ${workingDays} days requested.`
      }, { status: 400 })
    }

    // Check if user has any approved leave requests with 14+ days (first application rule)
    const approvedLeaveCheck = await db.query(`
      SELECT id, days FROM leave_requests
      WHERE user_id = $1 AND status = 'approved' AND days >= 14
      LIMIT 1
    `, [userId])

    const hasApproved14DayLeave = approvedLeaveCheck.rows.length > 0

    if (!hasApproved14DayLeave) {
      // This is the first application - enforce 14-day minimum or all remaining days
      if (remainingDays >= 14) {
        // User has 14+ days available, must book at least 14 days
        if (workingDays < 14) {
          return NextResponse.json({
            error: 'First leave application must be a minimum of 14 consecutive working days'
          }, { status: 400 })
        }
      } else {
        // User has less than 14 days, must book all remaining days in one block
        if (workingDays !== remainingDays) {
          return NextResponse.json({
            error: `User has ${remainingDays} days remaining. Since this is less than 14 days, they must book all ${remainingDays} days in one block for their first leave application.`
          }, { status: 400 })
        }
      }
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
    `, [userId, startDate, endDate])

    if (overlapResult.rows.length > 0) {
      return NextResponse.json({ error: 'User already has a leave request for overlapping dates' }, { status: 400 })
    }

    // Check position limits (max 5 captains, max 5 first officers per day)
    const positionCheckResult = await checkPositionLimits(startDate, endDate, userPosition, userId)
    if (!positionCheckResult.allowed) {
      return NextResponse.json({ error: positionCheckResult.error }, { status: 400 })
    }

    // Create the leave request as approved
    const result = await db.query(`
      INSERT INTO leave_requests (
        user_id, start_date, end_date, days, reason, status, approved_by, approved_at
      ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
      RETURNING *
    `, [userId, startDate, endDate, workingDays, reason || 'Added by admin', decoded.userId])

    // Update leave balance
    await db.query(
      'UPDATE leave_balances SET days_used = days_used + $1, updated_at = NOW() WHERE user_id = $2 AND year = $3',
      [workingDays, userId, currentYear]
    )

    const leaveRequest = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Leave added successfully',
      leaveRequest: {
        id: leaveRequest.id,
        userId: leaveRequest.user_id,
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        status: leaveRequest.status,
        approvedAt: leaveRequest.approved_at
      }
    })
  } catch (error) {
    console.error('Error adding leave:', error)
    return NextResponse.json({ error: 'Failed to add leave' }, { status: 500 })
  }
}

// Helper function to calculate working days
function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  excludedWeekdays: number[] = [],
  holidaySet: Set<string> = new Set()
): number {
  const startUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
  const endUTC = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))

  let count = 0
  const current = new Date(startUTC)

  while (current.getTime() <= endUTC.getTime()) {
    const dateString = current.toISOString().split('T')[0]
    if (!holidaySet.has(dateString)) {
      count++
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return count
}

// Helper function to check position limits (max 5 captains AND 5 first officers per day)
async function checkPositionLimits(
  startDate: string,
  endDate: string,
  userPosition: 'captain' | 'first_officer',
  userId: string
): Promise<{ allowed: boolean; error?: string }> {
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

  const captainCountByDate: Record<string, number> = {}
  const firstOfficerCountByDate: Record<string, number> = {}

  for (const row of result.rows) {
    const leaveStart = new Date(row.start_date)
    const leaveEnd = new Date(row.end_date)
    const position = row.position

    const current = new Date(leaveStart)
    while (current <= leaveEnd) {
      const dateStr = current.toISOString().split('T')[0]

      if (position === 'captain') {
        captainCountByDate[dateStr] = (captainCountByDate[dateStr] || 0) + 1
      } else if (position === 'first_officer') {
        firstOfficerCountByDate[dateStr] = (firstOfficerCountByDate[dateStr] || 0) + 1
      }

      current.setDate(current.getDate() + 1)
    }
  }

  const reqStart = new Date(startDate)
  const reqEnd = new Date(endDate)
  const current = new Date(reqStart)

  while (current <= reqEnd) {
    const dateStr = current.toISOString().split('T')[0]

    if (userPosition === 'captain') {
      const captainCount = captainCountByDate[dateStr] || 0
      if (captainCount >= 5) {
        return {
          allowed: false,
          error: `Maximum of 5 captains already on leave on ${dateStr}. Please select different dates.`
        }
      }
    } else if (userPosition === 'first_officer') {
      const firstOfficerCount = firstOfficerCountByDate[dateStr] || 0
      if (firstOfficerCount >= 5) {
        return {
          allowed: false,
          error: `Maximum of 5 first officers already on leave on ${dateStr}. Please select different dates.`
        }
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return { allowed: true }
}

