import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailService } from '@/lib/email'
import crypto from 'crypto'

// Simple in-memory rate limiter (per-instance)
const rateMap = new Map<string, { count: number; windowStart: number }>()
function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now - entry.windowStart > windowMs) {
    rateMap.set(key, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= limit) return true
  entry.count += 1
  return false
}

async function ensurePasswordResetTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function POST(request: NextRequest) {
  try {
    await ensurePasswordResetTable()

    const body = await request.json()
    const { email } = body as { email?: string }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Rate limiting (best-effort, avoids enumeration by returning success when limited)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipKey = `fp:ip:${ip}`
    const emailKey = `fp:email:${email.toLowerCase()}`
    const WINDOW_MS = 60 * 60 * 1000 // 1 hour
    const IP_LIMIT = 10 // per hour per IP
    const EMAIL_LIMIT = 3 // per hour per email

    const limited = isRateLimited(ipKey, IP_LIMIT, WINDOW_MS) || isRateLimited(emailKey, EMAIL_LIMIT, WINDOW_MS)
    if (limited) {
      // Always return success to prevent probing
      return NextResponse.json({ success: true })
    }

    // Look up user by email
    const userRes = await db.query('SELECT id, first_name, last_name, email FROM profiles WHERE email = $1', [email])

    // Always respond success to avoid email enumeration
    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: true })
    }

    const user = userRes.rows[0]

    // Generate token and store hash
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // 1-hour validity

    // Invalidate previous tokens for this user
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id])

    await db.query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, used)
       VALUES ($1, $2, $3, false)`,
      [tokenHash, user.id, expiresAt]
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    // Send email (best-effort)
    await emailService.sendPasswordResetEmail({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      resetUrl,
      expiresAt
    })

    // Do not expose whether email was sent successfully
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error initiating password reset:', error)
    // Still return success to avoid enumeration; optionally log server-side
    return NextResponse.json({ success: true })
  }
}

