import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Get and verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

    // Check if user is admin
    const userResult = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      )
    }

    // Check if invite exists and is not already used
    const inviteCheck = await db.query(
      'SELECT id, email, used FROM invites WHERE id = $1',
      [inviteId]
    )

    if (inviteCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    const invite = inviteCheck.rows[0]

    if (invite.used) {
      return NextResponse.json(
        { error: 'Cannot revoke an invite that has already been used' },
        { status: 400 }
      )
    }

    // Delete the invite
    await db.query('DELETE FROM invites WHERE id = $1', [inviteId])

    return NextResponse.json({
      success: true,
      message: 'Invite revoked successfully'
    })
  } catch (error) {
    console.error('Error revoking invite:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invite' },
      { status: 500 }
    )
  }
}
