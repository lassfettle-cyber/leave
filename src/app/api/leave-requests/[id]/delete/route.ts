import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // Check if user is admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Get the leave request details before deleting
    const leaveRequestRes = await db.query(
      'SELECT user_id, days, status FROM leave_requests WHERE id = $1',
      [id]
    )

    if (leaveRequestRes.rows.length === 0) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    const leaveRequest = leaveRequestRes.rows[0]
    const { user_id, days, status } = leaveRequest

    // If the leave request was approved, we need to restore the days to the user's balance
    if (status === 'approved') {
      const currentYear = new Date().getFullYear()
      await db.query(
        'UPDATE leave_balances SET days_used = days_used - $1, updated_at = NOW() WHERE user_id = $2 AND year = $3',
        [days, user_id, currentYear]
      )
    }

    // Delete the leave request
    await db.query('DELETE FROM leave_requests WHERE id = $1', [id])

    return NextResponse.json({
      success: true,
      message: 'Leave request deleted successfully',
      daysRestored: status === 'approved' ? days : 0
    })
  } catch (error) {
    console.error('Error deleting leave request:', error)
    return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 })
  }
}

