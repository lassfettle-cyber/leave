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

    // Recently approved leave (last 30 days) plus currently ongoing approved leave
    const result = await db.query(`
      SELECT 
        lr.*,
        p.first_name,
        p.last_name,
        (p.first_name || ' ' || p.last_name) as full_name
      FROM leave_requests lr
      JOIN profiles p ON lr.user_id = p.id
      WHERE lr.status = 'approved'
        AND (
          lr.end_date >= CURRENT_DATE -- ongoing or future
          OR lr.approved_at >= CURRENT_DATE - INTERVAL '30 days' -- recently approved
        )
      ORDER BY COALESCE(lr.approved_at, lr.start_date) DESC
      LIMIT 20
    `)

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Error fetching approved leave:', error)
    return NextResponse.json({ error: 'Failed to fetch approved leave' }, { status: 500 })
  }
}

