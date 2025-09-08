import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if ('error' in admin) return admin.error

  try {
    const { id } = await params
    await db.query('DELETE FROM holidays WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/settings/leave/holidays/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}

