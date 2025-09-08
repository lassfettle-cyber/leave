import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface InviteEmailData {
  email: string
  firstName: string
  lastName: string
  otpCode: string
  expiresAt: Date
  role: 'admin' | 'employee'
  invitedBy: string
}

export const emailService = {
  async sendInviteEmail(data: InviteEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured, skipping email send')
        return { success: false, error: 'Email service not configured' }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const expirationTime = data.expiresAt.toLocaleString()

      const { data: result, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
        to: [data.email],
        subject: `Invitation to Join Leave Management System - ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`,
        html: generateInviteEmailHTML(data, appUrl, expirationTime),
        text: generateInviteEmailText(data, appUrl, expirationTime)
      })

      if (error) {
        console.error('Resend email error:', error)
        return { success: false, error: error.message }
      }

      console.log('Invite email sent successfully:', result?.id)
      return { success: true }
    } catch (error) {
      console.error('Error sending invite email:', error)
      return { success: false, error: 'Failed to send email' }
    }
  }
}

function generateInviteEmailHTML(data: InviteEmailData, appUrl: string, expirationTime: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Leave Management System Invitation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .otp-code {
          background-color: #f3f4f6;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-number {
          font-size: 32px;
          font-weight: bold;
          color: #1f2937;
          letter-spacing: 4px;
          font-family: 'Courier New', monospace;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏢 Leave Management System</div>
          <h1>You're Invited!</h1>
        </div>
        
        <p>Hello <strong>${data.firstName} ${data.lastName}</strong>,</p>
        
        <p>You have been invited to join our Leave Management System as a <strong>${data.role}</strong>. To complete your registration, please use the following One-Time Password (OTP):</p>
        
        <div class="otp-code">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">Your OTP Code</div>
          <div class="otp-number">${data.otpCode}</div>
        </div>
        
        <div style="text-align: center;">
          <a href="${appUrl}/register?email=${encodeURIComponent(data.email)}" class="button">
            Complete Registration
          </a>
        </div>
        
        <div class="warning">
          <strong>⚠️ Important:</strong> This invitation expires on <strong>${expirationTime}</strong>. Please complete your registration before this time.
        </div>
        
        <h3>What's Next?</h3>
        <ol>
          <li>Click the "Complete Registration" button above</li>
          <li>Enter your email address and the OTP code provided</li>
          <li>Set up your password and complete your profile</li>
          <li>Start managing your leave requests!</li>
        </ol>
        
        <p>If you have any questions or need assistance, please contact your administrator.</p>
        
        <div class="footer">
          <p>This invitation was sent by ${data.invitedBy}</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateInviteEmailText(data: InviteEmailData, appUrl: string, expirationTime: string): string {
  return `
Leave Management System - Invitation

Hello ${data.firstName} ${data.lastName},

You have been invited to join our Leave Management System as a ${data.role}.

Your OTP Code: ${data.otpCode}

To complete your registration:
1. Visit: ${appUrl}/register?email=${encodeURIComponent(data.email)}
2. Enter your email address and the OTP code: ${data.otpCode}
3. Set up your password and complete your profile
4. Start managing your leave requests!

IMPORTANT: This invitation expires on ${expirationTime}

If you have any questions, please contact your administrator.

This invitation was sent by ${data.invitedBy}
If you didn't expect this invitation, you can safely ignore this email.
  `.trim()
}
