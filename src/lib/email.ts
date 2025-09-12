import { SMTPClient } from 'emailjs'
const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Leave Management System'
const fromEmail = process.env.FROM_EMAIL || 'noreply@yourdomain.com'
const fromName = process.env.FROM_NAME || appName
const fromAddress = `${fromName} <${fromEmail}>`


const smtpHost = process.env.SMTP_HOST || 'smtp.mailersend.net'
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS

async function smtpSend(to: string, subject: string, html: string, text: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!smtpUser || !smtpPass) {
      console.warn('SMTP credentials not configured, skipping email send')
      return { success: false, error: 'Email service not configured' }
    }

    const client = new SMTPClient({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      password: smtpPass,
      // Use STARTTLS on 587/2525
      tls: { rejectUnauthorized: false }
    })

    await new Promise((resolve, reject) => {
      client.send(
        {
          from: fromAddress,
          to,
          subject,
          text,
          // alternative=true marks it as the HTML version
          attachment: [{ data: html, alternative: true }]
        },
        (err, message) => {
          if (err) return reject(err)
          resolve(message)
        }
      )
    })

    return { success: true }
  } catch (err: any) {
    console.error('SMTP send error:', err)
    return { success: false, error: err?.message || 'SMTP send failed' }
  }
}

async function msApiSend(to: string, toName: string | undefined, subject: string, html: string, text: string): Promise<{ success: boolean; error?: string }>{
  try {
    const token = process.env.MAILERSEND_API_TOKEN
    if (!token) return { success: false, error: 'MAILERSEND_API_TOKEN not set' }

    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: [{ email: to, name: toName }],
        subject,
        text,
        html
      })
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('MailerSend API error:', res.status, errText)
      return { success: false, error: `MailerSend API error ${res.status}` }
    }

    return { success: true }
  } catch (err: any) {
    console.error('MailerSend API send error:', err)
    return { success: false, error: err?.message || 'MailerSend API send failed' }
  }
}

async function sendEmail(to: string, toName: string | undefined, subject: string, html: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (process.env.MAILERSEND_API_TOKEN) {
    return msApiSend(to, toName, subject, html, text)
  }
  return smtpSend(to, subject, html, text)
}

export interface InviteEmailData {
  email: string
  firstName: string
  lastName: string
  otpCode: string
  expiresAt: Date
  role: 'admin' | 'employee'
  invitedBy: string
}

export interface ResetEmailData {
  email: string
  firstName: string
  lastName: string
  resetUrl: string
  expiresAt: Date
}


export const emailService = {
  async sendInviteEmail(data: InviteEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const expirationTime = data.expiresAt.toLocaleString()

      const html = generateInviteEmailHTML(data, appUrl, expirationTime)
      const text = generateInviteEmailText(data, appUrl, expirationTime)

      const result = await sendEmail(
        data.email,
        `${data.firstName} ${data.lastName}`,
        `Invitation to join ${appName} - ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`,
        html,
        text
      )
      return result
    } catch (error) {
      console.error('Error sending invite email:', error)
      return { success: false, error: 'Failed to send email' }
    }
  },
  async sendPasswordResetEmail(data: ResetEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const expirationTime = data.expiresAt.toLocaleString()

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reset your ${appName} password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f9fafb; padding: 20px; color: #111827;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px;">
            <h1 style="margin:0 0 8px 0;">Reset your ${appName} password</h1>
            <p>Hello <strong>${data.firstName} ${data.lastName}</strong>,</p>
            <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
            <p style="text-align:center;">
              <a href="${data.resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;">Reset password</a>
            </p>
            <p style="color:#6b7280;font-size:14px;">This link will expire on <strong>${expirationTime}</strong>. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `

      const text = `Reset your ${appName} password\n\nHello ${data.firstName} ${data.lastName},\n\nReset link: ${data.resetUrl}\n\nThis link will expire on ${expirationTime}. If you did not request a password reset, you can ignore this email.`

      return await sendEmail(
        data.email,
        `${data.firstName} ${data.lastName}`,
        `Reset your ${appName} password`,
        html,
        text
      )
    } catch (error) {
      console.error('Error sending password reset email:', error)
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f9fafb; padding: 20px; color: #111827; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; }
        .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; margin: 16px 0; }
        .otp { background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 16px; text-align: center; font-weight: bold; letter-spacing: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 style="margin:0 0 8px 0;">You're Invited!</h1>
        <p>Hello <strong>${data.firstName} ${data.lastName}</strong>,</p>
        <p>You have been invited to join our Leave Management System as a <strong>${data.role}</strong>. Use the One-Time Password (OTP) below to complete your registration.</p>
        <div class="otp">${data.otpCode}</div>
        <p style="text-align:center;">
          <a href="${appUrl}/register?email=${encodeURIComponent(data.email)}" class="btn">Complete Registration</a>
        </p>
        <p style="color:#6b7280;font-size:14px;">This invitation expires on <strong>${expirationTime}</strong>.</p>
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
  `.trim()
}
