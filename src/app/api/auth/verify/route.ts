import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { profileService } from '@/lib/database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
    
    // Get user profile
    const profile = await profileService.getProfile(decoded.userId)
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        profile
      }
    })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }
}
