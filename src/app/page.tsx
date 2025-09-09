import { redirect } from 'next/navigation'
import AdminRegistration from '@/components/AdminRegistration'
import { profileService } from '@/lib/database'

export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const adminExists = await profileService.checkAdminExists()
    if (adminExists) {
      redirect('/login')
    }
  } catch (error) {
    console.error('Error checking admin:', error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-800 mb-2">Configuration Error</h1>
            <p className="text-red-700 mb-4">Failed to connect to database. Please check your configuration.</p>
            <div className="text-sm text-red-600 bg-red-100 p-3 rounded border">
              <p className="font-medium mb-2">Please ensure your .env.local file contains:</p>
              <ul className="text-left space-y-1">
                <li>• DATABASE_URL</li>
                <li>• JWT_SECRET</li>
                <li>• NEON_PROJECT_ID</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Leave Management System</h1>
            <p className="text-muted-foreground mt-2">
              Welcome! Let's set up your admin account.
            </p>
          </div>

          <AdminRegistration />
        </div>
      </div>
    </div>
  )
}
