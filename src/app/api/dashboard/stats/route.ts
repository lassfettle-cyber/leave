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
    
    // Get dashboard statistics
    const [pendingCount, approvedThisMonth, totalEmployees, totalLeaveDays] = await Promise.all([
      // Pending requests count
      db.query('SELECT COUNT(*) as count FROM leave_requests WHERE status = $1', ['pending']),
      
      // Approved requests this month
      db.query(`
        SELECT COUNT(*) as count 
        FROM leave_requests 
        WHERE status = $1 
          AND DATE_TRUNC('month', approved_at) = DATE_TRUNC('month', CURRENT_DATE)
      `, ['approved']),
      
      // Total employees
      db.query('SELECT COUNT(*) as count FROM profiles WHERE role = $1', ['employee']),
      
      // Total available leave days
      db.query(`
        SELECT COALESCE(SUM(days_allocated - days_used), 0) as total 
        FROM leave_balances 
        WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      `)
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        pendingRequests: parseInt(pendingCount.rows[0].count),
        approvedThisMonth: parseInt(approvedThisMonth.rows[0].count),
        totalEmployees: parseInt(totalEmployees.rows[0].count),
        availableDays: parseInt(totalLeaveDays.rows[0].total || 0)
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
