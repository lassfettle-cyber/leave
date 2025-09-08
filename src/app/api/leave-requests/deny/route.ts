import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(request: NextRequest) {
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
    const userResult = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { requestId, adminNotes } = body

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      )
    }

    // Get the leave request to verify it exists and is pending
    const requestResult = await db.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [requestId]
    )

    if (requestResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    const leaveRequest = requestResult.rows[0]

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be denied' },
        { status: 400 }
      )
    }

    // Update the leave request status to denied
    await db.query(`
      UPDATE leave_requests
      SET status = 'denied',
          approved_by = $1,
          approved_at = NOW(),
          admin_notes = $2
      WHERE id = $3
    `, [decoded.userId, adminNotes || null, requestId])

    return NextResponse.json({
      success: true,
      message: 'Leave request denied successfully'
    })
  } catch (error) {
    console.error('Error denying leave request:', error)
    return NextResponse.json(
      { error: 'Failed to deny leave request' },
      { status: 500 }
    )
  }
}
