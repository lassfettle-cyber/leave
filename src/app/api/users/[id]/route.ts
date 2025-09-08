import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // Check admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const { first_name, other_names, last_name, phone, role, leave_cycle_start } = body

    // Build dynamic update
    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    const push = (sql: string, val: any) => {
      fields.push(`${sql} = $${idx++}`)
      values.push(val)
    }

    if (first_name !== undefined) push('first_name', first_name)
    if (other_names !== undefined) push('other_names', other_names || null)
    if (last_name !== undefined) push('last_name', last_name)
    if (phone !== undefined) push('phone', phone)
    if (role !== undefined) push('role', role)
    if (leave_cycle_start !== undefined) push('leave_cycle_start', leave_cycle_start)

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id)

    const sql = `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, first_name, last_name, other_names, phone, role, leave_cycle_start, created_at, updated_at`

    const result = await db.query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, profile: result.rows[0] })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

