import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

async function ensureLeaveTables() {
  // Create settings and holidays tables if they don't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.leave_settings (
      id int PRIMARY KEY,
      excluded_weekdays int[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
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

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('error' in admin) return admin.error

  try {
    // Ensure schema and a settings row exist
    await ensureLeaveTables()
    await db.query('INSERT INTO public.leave_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING')

    const settingsRes = await db.query(
      'SELECT id, excluded_weekdays, created_at, updated_at FROM public.leave_settings WHERE id = 1'
    )

    const holidaysRes = await db.query(
      'SELECT id, holiday_date, name, created_at, updated_at FROM public.holidays ORDER BY holiday_date ASC'
    )

    return NextResponse.json({
      success: true,
      settings: settingsRes.rows[0] || { id: 1, excluded_weekdays: [] },
      holidays: holidaysRes.rows
    })
  } catch (error) {
    console.error('GET /api/settings/leave error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('error' in admin) return admin.error

  try {
    await ensureLeaveTables()
    const body = await request.json()
    const excluded: number[] = Array.isArray(body.excluded_weekdays) ? body.excluded_weekdays : []

    // sanitize to integers 0..6 unique
    const cleaned = Array.from(new Set(excluded.map((n: any) => parseInt(String(n), 10)).filter((n) => n >= 0 && n <= 6)))

    await db.query(`
      INSERT INTO public.leave_settings (id, excluded_weekdays)
      VALUES (1, $1::int[])
      ON CONFLICT (id) DO UPDATE
      SET excluded_weekdays = EXCLUDED.excluded_weekdays,
          updated_at = NOW()
    `, [cleaned])

    const settingsRes = await db.query('SELECT id, excluded_weekdays, created_at, updated_at FROM public.leave_settings WHERE id = 1')
    return NextResponse.json({ success: true, settings: settingsRes.rows[0] })
  } catch (error) {
    console.error('PUT /api/settings/leave error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

