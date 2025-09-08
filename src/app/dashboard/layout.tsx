'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardSidebar from '@/components/DashboardSidebar'
import DashboardHeader from '@/components/DashboardHeader'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requireAdmin={false}>
      <div className="min-h-screen bg-gray-50">
        <DashboardSidebar />
        <div className="lg:pl-64">
          <DashboardHeader />
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
