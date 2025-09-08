'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DashboardHeader() {
  const { user } = useAuth()

  const getCurrentTime = () => {
    return new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="lg:hidden">
              {/* Space for mobile menu button */}
              <div className="w-10"></div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Welcome back, {user?.profile?.first_name}!
              </h1>
              <p className="text-sm text-gray-500">{getCurrentTime()}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications placeholder */}
            <button className="relative p-2 text-gray-400 hover:text-gray-500">
              <span className="sr-only">View notifications</span>
              <div className="w-6 h-6 flex items-center justify-center">
                🔔
              </div>
              {/* Notification badge */}
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
            </button>

            {/* User avatar */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.profile?.first_name?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
