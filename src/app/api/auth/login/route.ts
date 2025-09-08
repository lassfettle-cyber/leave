import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'
import type { Profile } from '@/types/database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get user by email
    const result = await db.query(
      'SELECT * FROM profiles WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const profile = result.rows[0] as Profile

    if (!profile.password_hash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, profile.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: profile.id, email: profile.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Remove password hash from profile before returning
    const { password_hash, ...profileWithoutPassword } = profile

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: profile.id,
        email: profile.email,
        profile: profileWithoutPassword as Profile
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
