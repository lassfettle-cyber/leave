import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, otpCode } = body

    // Validate required fields
    if (!email || !otpCode) {
      return NextResponse.json(
        { error: 'Email and OTP code are required' },
        { status: 400 }
      )
    }

    // Find the invite
    const result = await db.query(`
      SELECT * FROM invites 
      WHERE email = $1 AND otp_code = $2 AND used = false AND expires_at > NOW()
    `, [email, otpCode])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      )
    }

    const invite = result.rows[0]

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

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        first_name: invite.first_name,
        last_name: invite.last_name,
        phone: invite.phone,
        role: invite.role,
        days_allocated: invite.days_allocated
      }
    })
  } catch (error) {
    console.error('Error verifying invite:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
