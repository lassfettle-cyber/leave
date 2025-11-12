import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Default to current month if no dates provided
    const now = new Date()
    const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const defaultEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    // Load leave calculation settings and holidays for range
    const settingsRes = await db.query(`SELECT excluded_weekdays FROM public.leave_settings WHERE id = 1`)
    const excludedWeekdays: number[] = settingsRes.rows?.[0]?.excluded_weekdays || []

    const holidaysRes = await db.query(
      `SELECT holiday_date::text AS date
       FROM public.holidays
       WHERE holiday_date BETWEEN $1::date AND $2::date`,
      [defaultStart, defaultEnd]
    )
    const holidaySet = new Set<string>(holidaysRes.rows.map((r: any) => r.date))

    // Get all approved leave requests within the date range
    const result = await db.query(`
      SELECT
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.days,
        lr.reason,
        lr.status,
        p.id as user_id,
        p.first_name,
        p.last_name,
        p.email,
        p.position,
        (p.first_name || ' ' || p.last_name) as full_name
      FROM leave_requests lr
      JOIN profiles p ON lr.user_id = p.id
      WHERE lr.status = 'approved'
        AND lr.start_date <= $2
        AND lr.end_date >= $1
      ORDER BY lr.start_date ASC, p.first_name ASC
    `, [defaultStart, defaultEnd])

    // Transform the data to include individual days for each leave request
    const leaveBlocks = []

    for (const request of result.rows) {
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)
      const currentDate = new Date(startDate)

      // Generate individual day entries for the leave block
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay() // 0=Sun..6=Sat
        const dateString = currentDate.toISOString().split('T')[0]

        // Skip excluded weekdays and holidays
        if (!excludedWeekdays.includes(dayOfWeek) && !holidaySet.has(dateString)) {
          leaveBlocks.push({
            id: request.id,
            date: dateString,
            user: {
              id: request.user_id,
              firstName: request.first_name,
              lastName: request.last_name,
              fullName: request.full_name,
              email: request.email,
              position: request.position,
              initials: (request.first_name?.[0] || '') + (request.last_name?.[0] || '')
            },
            reason: request.reason,
            isStart: currentDate.getTime() === startDate.getTime(),
            isEnd: currentDate.getTime() === endDate.getTime(),
            totalDays: request.days
          })
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return NextResponse.json({
      success: true,
      leaveBlocks,
      dateRange: {
        start: defaultStart,
        end: defaultEnd
      }
    })
  } catch (error) {
    console.error('Error fetching calendar leave requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    )
  }
}
