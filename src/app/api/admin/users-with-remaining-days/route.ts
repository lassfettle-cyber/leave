import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }

    // Check if user is admin
    const adminRes = await db.query('SELECT role FROM profiles WHERE id = $1', [decoded.userId])
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()

    // Get users with remaining leave days (employees only)
    const usersResult = await db.query(`
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.email,
        p.position,
        (p.first_name || ' ' || p.last_name) as full_name,
        lb.days_allocated,
        lb.days_used,
        (lb.days_allocated - lb.days_used) as days_remaining
      FROM profiles p
      LEFT JOIN leave_balances lb ON p.id = lb.user_id AND lb.year = $1
      WHERE p.role = 'employee'
        AND lb.days_allocated IS NOT NULL
        AND (lb.days_allocated - lb.days_used) > 0
      ORDER BY p.first_name ASC, p.last_name ASC
    `, [currentYear])

    // Get users with expired invites (who haven't registered yet)
    const expiredInvitesResult = await db.query(`
      SELECT 
        i.id as invite_id,
        i.email,
        i.first_name,
        i.last_name,
        i.position,
        i.days_allocated,
        (i.first_name || ' ' || i.last_name) as full_name,
        i.expires_at
      FROM invites i
      WHERE i.used = false
        AND i.expires_at < NOW()
      ORDER BY i.first_name ASC, i.last_name ASC
    `)

    return NextResponse.json({
      success: true,
      usersWithRemainingDays: usersResult.rows.map((row: any) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        email: row.email,
        position: row.position,
        daysAllocated: parseInt(row.days_allocated) || 0,
        daysUsed: parseInt(row.days_used) || 0,
        daysRemaining: parseInt(row.days_remaining) || 0
      })),
      usersWithExpiredInvites: expiredInvitesResult.rows.map((row: any) => ({
        inviteId: row.invite_id,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        email: row.email,
        position: row.position,
        daysAllocated: parseInt(row.days_allocated) || 0,
        expiresAt: row.expires_at
      }))
    })
  } catch (error) {
    console.error('Error fetching users with remaining days:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

