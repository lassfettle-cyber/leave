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

    // Start transaction
    await db.query('BEGIN')

    try {
      // Get the leave request
      const requestResult = await db.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [requestId]
      )

      if (requestResult.rows.length === 0) {
        await db.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Leave request not found' },
          { status: 404 }
        )
      }

      const leaveRequest = requestResult.rows[0]

      if (leaveRequest.status !== 'pending') {
        await db.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Only pending requests can be approved' },
          { status: 400 }
        )
      }

      // Update the leave request status with all approval fields
      await db.query(`
        UPDATE leave_requests
        SET status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            admin_notes = $2
        WHERE id = $3
      `, [decoded.userId, adminNotes || null, requestId])

      // Update the user's leave balance
      const currentYear = new Date().getFullYear()
      await db.query(`
        UPDATE leave_balances
        SET days_used = days_used + $1,
            updated_at = NOW()
        WHERE user_id = $2 AND year = $3
      `, [leaveRequest.days, leaveRequest.user_id, currentYear])

      // Commit transaction
      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Leave request approved successfully'
      })
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error approving leave request:', error)
    console.error('Error details:', error)
    return NextResponse.json(
      { error: 'Failed to approve leave request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
