import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    jwt.verify(token, JWT_SECRET)

    // Heuristics for reminders (can be refined):
    // 1) Pending requests starting within 7 days or already past start date
    // 2) Approved requests starting within 7 days (confirm or update if plans changed)
    const pendingSoon = await db.query(`
      SELECT lr.id as request_id, lr.user_id, p.first_name, p.last_name, (p.first_name || ' ' || p.last_name) as full_name,
             lr.start_date, lr.end_date, lr.status,
             CASE WHEN lr.start_date < CURRENT_DATE THEN 'Pending request past start date'
                  ELSE 'Pending request starting soon'
             END AS reason
      FROM leave_requests lr
      JOIN profiles p ON p.id = lr.user_id
      WHERE lr.status = 'pending'
        AND lr.start_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY lr.start_date ASC
      LIMIT 50
    `)

    const approvedSoon = await db.query(`
      SELECT lr.id as request_id, lr.user_id, p.first_name, p.last_name, (p.first_name || ' ' || p.last_name) as full_name,
             lr.start_date, lr.end_date, lr.status,
             'Approved leave starting soon' AS reason
      FROM leave_requests lr
      JOIN profiles p ON p.id = lr.user_id
      WHERE lr.status = 'approved'
        AND lr.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY lr.start_date ASC
      LIMIT 50
    `)

    const data = [...pendingSoon.rows, ...approvedSoon.rows]

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching reminder candidates:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

