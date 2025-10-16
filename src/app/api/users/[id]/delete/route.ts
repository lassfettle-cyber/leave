import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function DELETE(
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

    // Check if user is admin
    const adminCheck = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    // Prevent deleting yourself
    if (userId === decoded.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, email FROM profiles WHERE id = $1',
      [userId]
    )

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = userCheck.rows[0]

    // Begin transaction to delete user and all related data
    await db.query('BEGIN')

    try {
      // Delete leave requests
      await db.query('DELETE FROM leave_requests WHERE user_id = $1', [userId])

      // Delete leave balances
      await db.query('DELETE FROM leave_balances WHERE user_id = $1', [userId])

      // Delete password reset tokens
      await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId])

      // Delete the user profile
      await db.query('DELETE FROM profiles WHERE id = $1', [userId])

      // Commit transaction
      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `User ${user.first_name} ${user.last_name} (${user.email}) and all associated data have been permanently deleted`
      })
    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

