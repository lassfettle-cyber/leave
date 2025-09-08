import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import type { Profile } from '@/types/database'

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
    
    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Get current user profile
    const result = await db.query(
      'SELECT * FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const profile = result.rows[0] as Profile

    if (!profile.password_hash) {
      return NextResponse.json(
        { error: 'Password not set for this user' },
        { status: 400 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, profile.password_hash)

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    // Update password in database
    const updateResult = await db.query(
      'UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [newPasswordHash, decoded.userId]
    )

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
