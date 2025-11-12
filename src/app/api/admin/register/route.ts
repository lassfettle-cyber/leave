import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { profileService } from '@/lib/database'
import type { Profile } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, otherNames, lastName, phone } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const adminExists = await profileService.checkAdminExists()
    if (adminExists) {
      return NextResponse.json(
        { error: 'Admin already exists' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM profiles WHERE email = $1',
      [email]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create profile with auth data
    const result = await db.query(
      `INSERT INTO profiles (first_name, other_names, last_name, phone, email, password_hash, role, leave_cycle_start)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        firstName,
        otherNames,
        lastName,
        phone,
        email,
        passwordHash,
        'admin',
        '2026-01-01' // All employees have same leave cycle: Jan 1 - Dec 31, 2026
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      )
    }

    const profile = result.rows[0] as Profile

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        profile
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
