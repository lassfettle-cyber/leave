import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import { emailService } from '@/lib/email'

export async function POST(request: NextRequest) {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

    // Check if user is admin
    const userResult = await db.query(
      'SELECT role, first_name, last_name FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      )
    }

    // Get the invite details
    const inviteResult = await db.query(`
      SELECT * FROM invites WHERE id = $1 AND used = false
    `, [inviteId])

    if (inviteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invite not found or already used' },
        { status: 404 }
      )
    }

    const invite = inviteResult.rows[0]

    // Check if invite has expired
    if (new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Cannot resend expired invite. Please create a new one.' },
        { status: 400 }
      )
    }

    // Generate new OTP code
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Update the invite with new OTP code and reset expiration
    const newExpiresAt = new Date()
    newExpiresAt.setHours(newExpiresAt.getHours() + 24) // 24 hours from now

    await db.query(`
      UPDATE invites 
      SET otp_code = $1, expires_at = $2, updated_at = NOW()
      WHERE id = $3
    `, [newOtpCode, newExpiresAt, inviteId])

    // Get the inviter's name for the email
    const inviterName = `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`

    // Send the email with new OTP
    const emailResult = await emailService.sendInviteEmail({
      email: invite.email,
      firstName: invite.first_name,
      lastName: invite.last_name,
      otpCode: newOtpCode,
      expiresAt: newExpiresAt,
      role: invite.role as 'admin' | 'employee',
      invitedBy: inviterName
    })

    // Log the result
    if (emailResult.success) {
      console.log(`Invite resent successfully to ${invite.email}`)
    } else {
      console.warn(`Failed to resend invite email to ${invite.email}:`, emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Invite resent successfully',
      emailSent: emailResult.success,
      emailError: emailResult.error,
      newExpiresAt: newExpiresAt.toISOString()
    })
  } catch (error) {
    console.error('Error resending invite:', error)
    return NextResponse.json(
      { error: 'Failed to resend invite' },
      { status: 500 }
    )
  }
}
