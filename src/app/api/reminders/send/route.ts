import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import { emailService } from '@/lib/email'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Leave Management System'

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Check if user is admin
    const adminCheck = await db.query(
      'SELECT role FROM profiles WHERE user_id = $1',
      [decoded.userId]
    )
    
    if (!adminCheck.rows[0] || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get userId from request body
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user details and leave balance
    const userResult = await db.query(`
      SELECT 
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        lb.days_allocated,
        lb.days_used,
        (lb.days_allocated - lb.days_used) as days_remaining,
        lb.year
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN leave_balances lb ON u.id = lb.user_id AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      WHERE u.id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userResult.rows[0]
    const daysRemaining = user.days_remaining || 0

    if (daysRemaining <= 0) {
      return NextResponse.json({ error: 'User has no remaining leave days' }, { status: 400 })
    }

    // Send reminder email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const dashboardUrl = `${appUrl.replace(/\/+$/, '')}/dashboard`

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Reminder</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f9fafb; padding: 20px; color: #111827; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; margin: 16px 0; }
          .highlight { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="margin:0 0 8px 0;">Leave Reminder</h1>
          <p>Hello <strong>${user.first_name} ${user.last_name}</strong>,</p>
          <p>This is a friendly reminder that you have <strong>${daysRemaining} leave day${daysRemaining !== 1 ? 's' : ''}</strong> remaining for ${user.year}.</p>
          <div class="highlight">
            <strong>Your Leave Balance:</strong><br>
            Allocated: ${user.days_allocated} days<br>
            Used: ${user.days_used} days<br>
            Remaining: <strong>${daysRemaining} days</strong>
          </div>
          <p>We encourage you to plan and submit your leave requests to ensure you make the most of your allocated leave days.</p>
          <p style="text-align:center;">
            <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
          </p>
          <p style="color:#6b7280;font-size:14px;">If you have any questions about your leave balance or need assistance, please contact your administrator.</p>
        </div>
      </body>
      </html>
    `

    const text = `
Leave Reminder

Hello ${user.first_name} ${user.last_name},

This is a friendly reminder that you have ${daysRemaining} leave day${daysRemaining !== 1 ? 's' : ''} remaining for ${user.year}.

Your Leave Balance:
- Allocated: ${user.days_allocated} days
- Used: ${user.days_used} days
- Remaining: ${daysRemaining} days

We encourage you to plan and submit your leave requests to ensure you make the most of your allocated leave days.

Go to Dashboard: ${dashboardUrl}

If you have any questions about your leave balance or need assistance, please contact your administrator.
    `.trim()

    const result = await emailService.sendEmail(
      user.email,
      `${user.first_name} ${user.last_name}`,
      `Reminder: You have ${daysRemaining} leave day${daysRemaining !== 1 ? 's' : ''} remaining`,
      html,
      text
    )

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to send reminder email' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Reminder sent to ${user.email}`,
      messageId: result.messageId
    })

  } catch (error) {
    console.error('Error sending reminder:', error)
    return NextResponse.json({ 
      error: 'Failed to send reminder' 
    }, { status: 500 })
  }
}

