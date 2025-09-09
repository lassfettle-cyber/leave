import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

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

export async function GET(request: NextRequest) {
  try {
    await ensurePasswordResetTable()

    const token = request.nextUrl.searchParams.get('token') || ''
    if (!token) {
      return NextResponse.json({ valid: false, reason: 'invalid' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const tokenRes = await db.query(
      `SELECT expires_at, used FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({ valid: false, reason: 'invalid' })
    }

    const row = tokenRes.rows[0]
    if (row.used) return NextResponse.json({ valid: false, reason: 'used' })
    if (new Date(row.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' })

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error validating reset token:', error)
    return NextResponse.json({ valid: false, reason: 'invalid' })
  }
}

