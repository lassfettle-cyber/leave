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

    // Check if user exists
    const userCheck = await db.query('SELECT id, first_name, last_name FROM profiles WHERE id = $1', [userId])
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get leave settings (excluded weekdays and holidays)
    const settingsRes = await db.query('SELECT excluded_weekdays FROM leave_settings WHERE id = 1')
    const excludedWeekdays: number[] = settingsRes.rows[0]?.excluded_weekdays || []

    const holidaysRes = await db.query('SELECT holiday_date FROM holidays')
    const holidaySet = new Set<string>(
      holidaysRes.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0])
    )

    // Calculate working days
    let workingDays = 0
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay()
      const dateString = currentDate.toISOString().split('T')[0]
      
      if (!excludedWeekdays.includes(dayOfWeek) && !holidaySet.has(dateString)) {
        workingDays++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (workingDays === 0) {
      return NextResponse.json({ error: 'No working days in the selected date range' }, { status: 400 })
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

