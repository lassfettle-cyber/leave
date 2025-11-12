import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    const { id: userId } = await params

    // Get user details
    const userResult = await db.query(
      `SELECT id, first_name, last_name, email, position, role
       FROM profiles
       WHERE id = $1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Get all leave requests for this user
    const leaveResult = await db.query(
      `SELECT 
        id,
        start_date,
        end_date,
        days,
        reason,
        status,
        created_at
       FROM leave_requests
       WHERE user_id = $1
       ORDER BY start_date DESC`,
      [userId]
    )

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        position: user.position,
        role: user.role
      },
      leaveRequests: leaveResult.rows.map(row => ({
        id: row.id,
        startDate: row.start_date,
        endDate: row.end_date,
        days: row.days,
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at
      }))
    })
  } catch (error) {
    console.error('Error fetching user leave:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user leave' },
      { status: 500 }
    )
  }
}

