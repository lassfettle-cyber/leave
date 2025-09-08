import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
    
    // Get employee leave balance and stats
    const result = await db.query(`
      SELECT 
        lb.days_allocated,
        lb.days_used,
        (lb.days_allocated - lb.days_used) as days_remaining,
        (
          SELECT COUNT(*) 
          FROM leave_requests lr 
          WHERE lr.user_id = $1 AND lr.status = 'pending'
        ) as pending_requests,
        (
          SELECT COUNT(*) 
          FROM leave_requests lr 
          WHERE lr.user_id = $1 
            AND lr.status = 'approved' 
            AND lr.start_date >= CURRENT_DATE
        ) as upcoming_leave
      FROM leave_balances lb
      WHERE lb.user_id = $1
    `, [decoded.userId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave balance not found' },
        { status: 404 }
      )
    }

    const balance = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        daysAllocated: balance.days_allocated,
        daysUsed: balance.days_used,
        daysRemaining: balance.days_remaining,
        pendingRequests: parseInt(balance.pending_requests),
        upcomingLeave: parseInt(balance.upcoming_leave)
      }
    })
  } catch (error) {
    console.error('Error fetching employee balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balance' },
      { status: 500 }
    )
  }
}
