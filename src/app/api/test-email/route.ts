import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const to = url.searchParams.get('to') || process.env.FROM_EMAIL
    const toName = url.searchParams.get('name') || 'Test User'

    if (!to) {
      return NextResponse.json({ success: false, error: 'Provide ?to=email or set FROM_EMAIL' }, { status: 400 })
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const resetUrl = new URL('/login', base).toString()

    const result = await emailService.sendPasswordResetEmail({
      email: to,
      firstName: toName.split(' ')[0] || 'Test',
      lastName: toName.split(' ').slice(1).join(' ') || 'User',
      resetUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    })

    return NextResponse.json({ success: result.success, error: result.error || null, provider: process.env.BREVO_API_KEY ? 'brevo' : 'smtp' })
  } catch (err: any) {
    console.error('test-email error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Failed to send test email' }, { status: 500 })
  }
}

