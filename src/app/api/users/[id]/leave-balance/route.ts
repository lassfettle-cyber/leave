import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // check admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE user_id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const year = new Date().getFullYear()

    // Get leave balance for the user - simplified query
    const balanceResult = await db.query(
      `SELECT
        days_allocated,
        days_used,
        (days_allocated - days_used) as days_remaining
      FROM leave_balances
      WHERE user_id = $1 AND year = $2`,
      [id, year]
    )

    if (balanceResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          days_allocated: 0,
          days_used: 0,
          days_remaining: 0
        }
      })
    }

    const balance = balanceResult.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        days_allocated: parseInt(balance.days_allocated) || 0,
        days_used: parseInt(balance.days_used) || 0,
        days_remaining: parseInt(balance.days_remaining) || 0
      }
    })
  } catch (error) {
    console.error('Error fetching leave balance:', error)
    return NextResponse.json({ error: 'Failed to fetch leave balance' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // check admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const year: number = body.year || new Date().getFullYear()
    const daysAllocated: number = body.daysAllocated

    if (typeof daysAllocated !== 'number' || daysAllocated < 0) {
      return NextResponse.json({ error: 'daysAllocated must be a non-negative number' }, { status: 400 })
    }

    // check if exists
    const exists = await db.query(
      'SELECT id FROM leave_balances WHERE user_id = $1 AND year = $2',
      [id, year]
    )

    if (exists.rows.length > 0) {
      return NextResponse.json({ error: `Allocation already exists for ${year}` }, { status: 409 })
    }

    const insert = await db.query(
      `INSERT INTO leave_balances (user_id, year, days_allocated, days_used)
       VALUES ($1, $2, $3, 0)
       RETURNING id, user_id, year, days_allocated, days_used, created_at, updated_at`,
      [id, year, daysAllocated]
    )

    return NextResponse.json({ success: true, balance: insert.rows[0] })
  } catch (error) {
    console.error('Error creating leave allocation:', error)
    return NextResponse.json({ error: 'Failed to create leave allocation' }, { status: 500 })
  }
}

