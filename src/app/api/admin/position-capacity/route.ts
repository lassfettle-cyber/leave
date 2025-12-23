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

    // Check if user is admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get position and userId from query params
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position')
    const userId = searchParams.get('userId')

    if (!position || !['captain', 'first_officer'].includes(position)) {
      return NextResponse.json(
        { error: 'Valid position parameter required (captain or first_officer)' },
        { status: 400 }
      )
    }

    // Get all approved leave requests for 2026 with position info
    // Exclude the specified user if provided
    const query = userId
      ? `SELECT lr.start_date, lr.end_date, p.position
         FROM leave_requests lr
         JOIN profiles p ON lr.user_id = p.id
         WHERE lr.status = 'approved'
           AND lr.user_id != $1
           AND EXTRACT(YEAR FROM lr.start_date) = 2026
           AND p.position IS NOT NULL`
      : `SELECT lr.start_date, lr.end_date, p.position
         FROM leave_requests lr
         JOIN profiles p ON lr.user_id = p.id
         WHERE lr.status = 'approved'
           AND EXTRACT(YEAR FROM lr.start_date) = 2026
           AND p.position IS NOT NULL`

    const result = userId 
      ? await db.query(query, [userId])
      : await db.query(query)

    // Build maps of date -> count by position
    const captainCountByDate: Record<string, number> = {}
    const firstOfficerCountByDate: Record<string, number> = {}

    for (const row of result.rows) {
      const leaveStart = new Date(row.start_date)
      const leaveEnd = new Date(row.end_date)
      const leavePosition = row.position

      // Iterate through each day of this leave request
      const current = new Date(leaveStart)
      while (current <= leaveEnd) {
        const dateStr = current.toISOString().split('T')[0]
        
        if (leavePosition === 'captain') {
          captainCountByDate[dateStr] = (captainCountByDate[dateStr] || 0) + 1
        } else if (leavePosition === 'first_officer') {
          firstOfficerCountByDate[dateStr] = (firstOfficerCountByDate[dateStr] || 0) + 1
        }
        
        current.setDate(current.getDate() + 1)
      }
    }

    // Find dates at capacity for the specified position (5 or more)
    const disabledDates: string[] = []
    
    if (position === 'captain') {
      for (const [date, count] of Object.entries(captainCountByDate)) {
        if (count >= 5) {
          disabledDates.push(date)
        }
      }
    } else if (position === 'first_officer') {
      for (const [date, count] of Object.entries(firstOfficerCountByDate)) {
        if (count >= 5) {
          disabledDates.push(date)
        }
      }
    }

    return NextResponse.json({
      success: true,
      disabledDates,
      position
    })
  } catch (error) {
    console.error('Error checking position capacity:', error)
    return NextResponse.json(
      { error: 'Failed to check position capacity' },
      { status: 500 }
    )
  }
}

