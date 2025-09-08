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
    
    // Get upcoming leave (approved leave requests starting from today)
    const result = await db.query(`
      SELECT 
        lr.*,
        p.first_name,
        p.last_name,
        (p.first_name || ' ' || p.last_name) as full_name
      FROM leave_requests lr
      JOIN profiles p ON lr.user_id = p.id
      WHERE lr.status = 'approved' 
        AND lr.start_date >= CURRENT_DATE
      ORDER BY lr.start_date ASC
      LIMIT 10
    `)
    
    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching upcoming leave:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming leave' },
      { status: 500 }
    )
  }
}
