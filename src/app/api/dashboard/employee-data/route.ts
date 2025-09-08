import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export async function GET(request: NextRequest) {
  try {
    // Require Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    // Verify JWT token (throws if invalid)
    jwt.verify(token, JWT_SECRET)

    // Placeholder employee dashboard payload
    return NextResponse.json({
      success: true,
      data: {
        balance: {
          daysAllocated: 0,
          daysUsed: 0,
          daysRemaining: 0,
          pendingRequests: 0,
          upcomingLeave: 0,
        },
        upcomingLeave: [],
        myLeave: [],
      },
    })
  } catch (error) {
    console.error('Error fetching employee dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee dashboard data' },
      { status: 500 }
    )
  }
}

