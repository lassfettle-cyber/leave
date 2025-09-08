import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { profileService } from '@/lib/database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function PUT(request: NextRequest) {
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
    
    const body = await request.json()
    const { first_name, other_names, last_name, phone, leave_cycle_start } = body

    // Validate required fields
    if (!first_name || !last_name || !phone || !leave_cycle_start) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update profile
    const updatedProfile = await profileService.updateProfile(decoded.userId, {
      first_name,
      other_names: other_names || undefined,
      last_name,
      phone,
      leave_cycle_start
    })

    if (updatedProfile) {
      return NextResponse.json({
        success: true,
        profile: updatedProfile
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
