import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import { emailService } from '@/lib/email'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

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
    
    // Get user profile to check if admin
    const userResult = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userProfile = userResult.rows[0]
    if (userProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, firstName, lastName, phone, role, daysAllocated } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !phone || !role || daysAllocated === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

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

    // Check if there's already a pending invite for this email
    const existingInvite = await db.query(
      'SELECT id FROM invites WHERE email = $1 AND used = false AND expires_at > NOW()',
      [email]
    )

    if (existingInvite.rows.length > 0) {
      return NextResponse.json(
        { error: 'There is already a pending invite for this email' },
        { status: 400 }
      )
    }

    // Generate OTP and set expiration (24 hours from now)
    const otpCode = generateOTP()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Create invite
    const result = await db.query(`
      INSERT INTO invites (
        email, 
        first_name, 
        last_name, 
        phone, 
        role, 
        days_allocated, 
        otp_code, 
        expires_at,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      email,
      firstName,
      lastName,
      phone,
      role,
      daysAllocated,
      otpCode,
      expiresAt,
      decoded.userId
    ])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      )
    }

    const invite = result.rows[0]

    // Get the inviter's name for the email
    const inviterResult = await db.query(
      'SELECT first_name, last_name FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    const inviterName = inviterResult.rows.length > 0
      ? `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}`
      : 'System Administrator'

    // Send invitation email
    const emailResult = await emailService.sendInviteEmail({
      email,
      firstName,
      lastName,
      otpCode,
      expiresAt,
      role: role as 'admin' | 'employee',
      invitedBy: inviterName
    })

    // Log the result
    if (emailResult.success) {
      console.log(`Invite email sent successfully to ${email}`)
    } else {
      console.warn(`Failed to send invite email to ${email}:`, emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Invite created successfully',
      emailSent: emailResult.success,
      emailError: emailResult.error,
      invite: {
        id: invite.id,
        email: invite.email,
        expires_at: invite.expires_at
        // Don't return OTP code in production for security
      }
    })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    )
  }
}
