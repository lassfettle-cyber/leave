import { NextResponse } from 'next/server'
import { profileService } from '@/lib/database'

export async function GET() {
  try {
    const adminExists = await profileService.checkAdminExists()
    return NextResponse.json({ adminExists })
  } catch (error) {
    console.error('Error checking admin:', error)
    return NextResponse.json({ error: 'Failed to check admin' }, { status: 500 })
  }
}
