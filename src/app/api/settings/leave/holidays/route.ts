import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

async function ensureHolidaysTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.holidays (
      id bigserial PRIMARY KEY,
      holiday_date date NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT holidays_unique_date UNIQUE (holiday_date)
    );
  `)
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Authorization token required' }, { status: 401 }) }
  }
  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
    }
    return { userId: decoded.userId }
  } catch (e) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('error' in admin) return admin.error

  try {
    await ensureHolidaysTable()
    const body = await request.json()
    const date = body.holiday_date || body.date
    const name: string = body.name

    if (!date || !name) {
      return NextResponse.json({ error: 'holiday_date and name are required' }, { status: 400 })
    }

    const insert = await db.query(
      `INSERT INTO holidays (holiday_date, name)
       VALUES ($1, $2)
       ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id, holiday_date, name, created_at, updated_at`,
      [date, name]
    )

    return NextResponse.json({ success: true, holiday: insert.rows[0] })
  } catch (error) {
    console.error('POST /api/settings/leave/holidays error:', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

