import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, otpCode, password } = body

    // Validate required fields
    if (!email || !otpCode || !password) {
      return NextResponse.json(
        { error: 'Email, OTP code, and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Find and verify the invite
    const inviteResult = await db.query(`
      SELECT * FROM invites 
      WHERE email = $1 AND otp_code = $2 AND used = false AND expires_at > NOW()
    `, [email, otpCode])

    if (inviteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      )
    }

    const invite = inviteResult.rows[0]

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM profiles WHERE email = $1',
      [email]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate user ID
    const userId = uuidv4()

    // Set leave cycle start date (Jan 1, 2026 - all employees have same cycle)
    const leaveCycleStart = '2026-01-01'

    // Begin transaction
    await db.query('BEGIN')

    try {
      // Create the user profile
      await db.query(`
        INSERT INTO profiles (
          id, email, first_name, last_name, phone, password_hash, role, position, leave_cycle_start
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        userId,
        invite.email,
        invite.first_name,
        invite.last_name,
        invite.phone,
        passwordHash,
        invite.role,
        invite.position,
        leaveCycleStart
      ])

      // Create leave balance for the user
      const currentYear = new Date().getFullYear()
      await db.query(`
        INSERT INTO leave_balances (user_id, year, days_allocated, days_used)
        VALUES ($1, $2, $3, 0)
      `, [userId, currentYear, invite.days_allocated])

      // Mark the invite as used
      await db.query(`
        UPDATE invites SET used = true, updated_at = NOW()
        WHERE id = $1
      `, [invite.id])

      // Commit transaction
      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Registration completed successfully',
        user: {
          id: userId,
          email: invite.email,
          first_name: invite.first_name,
          last_name: invite.last_name,
          role: invite.role
        }
      })
    } catch (error) {
      // Rollback transaction on error
      await db.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error completing registration:', error)
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}
