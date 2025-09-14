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

    // Employees with remaining leave days (to remind to apply)
    const result = await db.query(`
      SELECT *
      FROM v_users_with_remaining_leave
      WHERE days_remaining > 0
      ORDER BY days_remaining DESC, last_name ASC
      LIMIT 100
    `)

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching reminder candidates:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

