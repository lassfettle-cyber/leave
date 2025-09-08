import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import type { Invite } from '@/types/database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
    
    // Get user profile to check if admin
    const userResult = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userProfile = userResult.rows[0]
    if (userProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get all invites
    const result = await db.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        days_allocated,
        otp_code,
        expires_at,
        used,
        created_at,
        updated_at
      FROM invites 
      ORDER BY created_at DESC
    `)

    const invites = result.rows as Invite[]

    return NextResponse.json({
      success: true,
      data: invites
    })
  } catch (error) {
    console.error('Error fetching invites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    )
  }
}
