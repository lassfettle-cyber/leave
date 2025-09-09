import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
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

export async function POST(request: NextRequest) {
  try {
    await ensurePasswordResetTable()

    const body = await request.json()
    const { token, newPassword } = body as { token?: string; newPassword?: string }

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const tokenRes = await db.query(
      `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const tokenRow = tokenRes.rows[0]
    if (tokenRow.used || new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await db.query('BEGIN')
    try {
      const updateRes = await db.query(
        `UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
        [passwordHash, tokenRow.user_id]
      )

      if (updateRes.rows.length === 0) {
        throw new Error('Failed to update password')
      }

      await db.query(
        `UPDATE password_reset_tokens SET used = true WHERE token_hash = $1`,
        [tokenHash]
      )

      await db.query('COMMIT')
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

    return NextResponse.json({ success: true, message: 'Password has been reset successfully' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

