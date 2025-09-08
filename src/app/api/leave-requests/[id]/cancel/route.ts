import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get and verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any

    const { id: requestId } = await params

    // Get the leave request
    const result = await db.query(
      'SELECT * FROM leave_requests WHERE id = $1',
      [requestId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    const leaveRequest = result.rows[0]

    // Check if user owns this request or is admin
    const userResult = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    const userRole = userResult.rows[0]?.role
    const isOwner = leaveRequest.user_id === decoded.userId
    const isAdmin = userRole === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only cancel your own leave requests' },
        { status: 403 }
      )
    }

    // Check if request can be cancelled
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be cancelled' },
        { status: 400 }
      )
    }

    // Update the request status to cancelled
    await db.query(
      'UPDATE leave_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', requestId]
    )

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling leave request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel leave request' },
      { status: 500 }
    )
  }
}
