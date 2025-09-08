import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { leaveRequestService } from '@/lib/database'

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
    
    // Get pending requests
    const pendingRequests = await leaveRequestService.getPendingRequests()
    
    return NextResponse.json({
      success: true,
      data: pendingRequests
    })
  } catch (error) {
    console.error('Error fetching pending requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending requests' },
      { status: 500 }
    )
  }
}
