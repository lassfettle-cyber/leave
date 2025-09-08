import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL
    const hasJwtSecret = !!process.env.JWT_SECRET
    
    return NextResponse.json({ 
      status: 'ok',
      hasDbUrl,
      hasJwtSecret,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
