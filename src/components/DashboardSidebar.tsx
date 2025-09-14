'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const adminNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
  { name: 'User Management', href: '/dashboard/users', icon: '👥' },
  { name: 'Leave Calendar', href: '/dashboard/calendar', icon: '🗓️' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
]

const employeeNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
  { name: 'My Leave', href: '/dashboard/leave-requests', icon: '📅' },
  { name: 'Leave Calendar', href: '/dashboard/calendar', icon: '🗓️' },
]

export default function DashboardSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  // Get navigation based on user role
  const navigation = user?.profile?.role === 'admin' ? adminNavigation : employeeNavigation

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:hidden`}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Leave System</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <SidebarContent 
          navigation={navigation} 
          pathname={pathname} 
          user={user} 
          onSignOut={handleSignOut}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-white lg:shadow-lg">
        <div className="flex h-16 items-center px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Leave System</h1>
        </div>
        <SidebarContent 
          navigation={navigation} 
          pathname={pathname} 
          user={user} 
          onSignOut={handleSignOut}
        />
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 rounded-md bg-white p-2 text-gray-600 shadow-lg hover:text-gray-900"
        >
          <span className="sr-only">Open sidebar</span>
          ☰
        </button>
      </div>
    </>
  )
}

function SidebarContent({ 
  navigation, 
  pathname, 
  user, 
  onSignOut 
}: { 
  navigation: any[], 
  pathname: string, 
  user: any, 
  onSignOut: () => void 
}) {
  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User info and sign out */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center mb-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.profile?.first_name?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">
              {user?.profile?.first_name} {user?.profile?.last_name}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <span className="mr-3 text-lg">🚪</span>
          Sign Out
        </button>
      </div>
    </div>
  )
}
