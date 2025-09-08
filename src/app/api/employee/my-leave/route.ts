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
    
    // Get employee's leave requests
    const result = await db.query(`
      SELECT 
        lr.*,
        p.first_name,
        p.last_name,
        (p.first_name || ' ' || p.last_name) as full_name
      FROM leave_requests lr
      JOIN profiles p ON lr.user_id = p.id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC
    `, [decoded.userId])

    const leaveRequests = result.rows

    // Get user's leave balance
    const currentYear = new Date().getFullYear()
    const balanceResult = await db.query(`
      SELECT days_allocated, days_used
      FROM leave_balances
      WHERE user_id = $1 AND year = $2
    `, [decoded.userId, currentYear])

    const balance = balanceResult.rows[0] || { days_allocated: 0, days_used: 0 }
    const remainingDays = balance.days_allocated - balance.days_used

    return NextResponse.json({
      success: true,
      leaveRequests: leaveRequests,
      leaveBalance: {
        allocated: balance.days_allocated,
        used: balance.days_used,
        remaining: remainingDays
      }
    })
  } catch (error) {
    console.error('Error fetching employee leave requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
      { status: 500 }
    )
  }
}
