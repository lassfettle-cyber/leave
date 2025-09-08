'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminRegistration from '@/components/AdminRegistration'

export default function Home() {
  const router = useRouter()
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    checkForAdmin()
  }, [])

  const checkForAdmin = async () => {
    try {
      const response = await fetch('/api/admin/check')
      const data = await response.json()

      if (response.ok) {
        setHasAdmin(data.adminExists)
        // If admin exists, redirect to login page
        if (data.adminExists) {
          router.push('/login')
          return
        }
      } else {
        console.error('Error checking for admin:', data.error)
        setConfigError('Failed to connect to database. Please check your configuration.')
        setHasAdmin(false)
      }
    } catch (error) {
      console.error('Error:', error)
      setConfigError('Failed to connect to database. Please check your configuration.')
      setHasAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-800 mb-2">Configuration Error</h1>
            <p className="text-red-700 mb-4">{configError}</p>
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

          <AdminRegistration onSuccess={() => {
            setHasAdmin(true)
            router.push('/login')
          }} />
        </div>
      </div>
    </div>
  )
}
