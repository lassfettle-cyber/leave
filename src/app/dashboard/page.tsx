'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { PendingRequest, UpcomingLeave, UserWithRemainingLeave } from '@/types/database'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [upcomingLeave, setUpcomingLeave] = useState<UpcomingLeave[]>([])
  const [usersWithLeave, setUsersWithLeave] = useState<UserWithRemainingLeave[]>([])
  const [stats, setStats] = useState({
    pendingRequests: 0,
    approvedThisMonth: 0,
    totalEmployees: 0,
    availableDays: 0
  })
  const [pageLoading, setPageLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (user?.profile?.role === 'admin') {
      loadDashboardData()
    } else {
      // Employee data is loaded inside EmployeeDashboard; avoid premature calls here
      setPageLoading(false)
    }
  }, [authLoading, user])

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No auth token found')
        return
      }

      const headers = {
        'Authorization': `Bearer ${token}`
      }

      // Load different data based on user role
      if (user?.profile?.role === 'admin') {
        // Admin dashboard data
        const [pendingRes, upcomingRes, usersRes, statsRes] = await Promise.all([
          fetch('/api/dashboard/pending-requests', { headers }),
          fetch('/api/dashboard/upcoming-leave', { headers }),
          fetch('/api/dashboard/users-with-leave', { headers }),
          fetch('/api/dashboard/stats', { headers })
        ])

        if (pendingRes.ok) {
          const result = await pendingRes.json()
          if (result.success) setPendingRequests(result.data)
        }

        if (upcomingRes.ok) {
          const result = await upcomingRes.json()
          if (result.success) setUpcomingLeave(result.data)
        }

        if (usersRes.ok) {
          const result = await usersRes.json()
          if (result.success) setUsersWithLeave(result.data)
        }

        if (statsRes.ok) {
          const result = await statsRes.json()
          if (result.success) setStats(result.data)
        }
      } else {
        // Employee dashboard data - will implement later
        const response = await fetch('/api/dashboard/employee-data', { headers })
        if (response.ok) {
          const result = await response.json()
          // Handle employee data
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setPageLoading(false)
    }
  }

  const handleApprove = async (requestId: string, adminNotes?: string) => {
    setActionLoading(requestId)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No auth token found')
        return
      }

      const response = await fetch('/api/leave-requests/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, adminNotes })
      })

      if (response.ok) {
        // Refresh the pending requests
        await loadDashboardData()
      } else {
        const result = await response.json()
        console.error('Failed to approve request:', result.error)
      }
    } catch (error) {
      console.error('Error approving request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (requestId: string, adminNotes?: string) => {
    setActionLoading(requestId)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No auth token found')
        return
      }

      const response = await fetch('/api/leave-requests/deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, adminNotes })
      })

      if (response.ok) {
        // Refresh the pending requests
        await loadDashboardData()
      } else {
        const result = await response.json()
        console.error('Failed to deny request:', result.error)
      }
    } catch (error) {
      console.error('Error denying request:', error)
    } finally {
      setActionLoading(null)
    }
  }

  if (pageLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Render different dashboards based on user role
  if (user?.profile?.role === 'admin') {
    return <AdminDashboard
      pendingRequests={pendingRequests}
      upcomingLeave={upcomingLeave}
      usersWithLeave={usersWithLeave}
      stats={stats}
      actionLoading={actionLoading}
      onApprove={handleApprove}
      onDeny={handleDeny}
    />
  } else {
    return <EmployeeDashboard />
  }
}

// Admin Dashboard Component
function AdminDashboard({
  pendingRequests,
  upcomingLeave,
  usersWithLeave,
  stats,
  actionLoading,
  onApprove,
  onDeny
}: {
  pendingRequests: PendingRequest[]
  upcomingLeave: UpcomingLeave[]
  usersWithLeave: UserWithRemainingLeave[]
  stats: any
  actionLoading: string | null
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Overview of your leave management system</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Pending Requests"
          value={stats.pendingRequests}
          icon="⏳"
          color="yellow"
        />
        <StatsCard
          title="Approved This Month"
          value={stats.approvedThisMonth}
          icon="✅"
          color="green"
        />
        <StatsCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon="👥"
          color="blue"
        />
        <StatsCard
          title="Available Days"
          value={stats.availableDays}
          icon="📅"
          color="purple"
        />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending requests */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Leave Requests
          </h2>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No pending requests at the moment
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.full_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.days} day{request.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onApprove(request.id)}
                      disabled={actionLoading === request.id}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 disabled:opacity-50"
                    >
                      {actionLoading === request.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => onDeny(request.id)}
                      disabled={actionLoading === request.id}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                    >
                      {actionLoading === request.id ? 'Denying...' : 'Deny'}
                    </button>
                  </div>
                </div>
              ))}
              {pendingRequests.length > 5 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View all {pendingRequests.length} requests →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Leave */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upcoming Leave
          </h2>
          {upcomingLeave.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No upcoming leave scheduled
            </p>
          ) : (
            <div className="space-y-4">
              {upcomingLeave.slice(0, 5).map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {leave.full_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {leave.days} day{leave.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-blue-600 text-sm font-medium">
                    {Math.ceil((new Date(leave.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </div>
                </div>
              ))}
              {upcomingLeave.length > 5 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View all upcoming leave →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Users with Leave Days & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users with Leave Days */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Users with Leave Days
            </h2>
            <button className="text-sm text-blue-600 hover:text-blue-800">
              Send Reminders
            </button>
          </div>
          {usersWithLeave.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No users with remaining leave days
            </p>
          ) : (
            <div className="space-y-3">
              {usersWithLeave.slice(0, 5).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {user.full_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {user.days_remaining} days remaining
                    </p>
                  </div>
                  <button className="text-green-600 hover:text-green-800 text-sm">
                    Remind
                  </button>
                </div>
              ))}
              {usersWithLeave.length > 5 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View all users →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <QuickActionButton
              title="Add New Employee"
              description="Invite a new employee to the system"
              icon="➕"
              href="/dashboard/users"
            />
            <QuickActionButton
              title="View All Requests"
              description="Manage all leave requests"
              icon="📋"
              href="/dashboard/leave-requests"
            />
            <QuickActionButton
              title="System Settings"
              description="Configure leave policies"
              icon="⚙️"
              href="/dashboard/settings"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Employee Dashboard Component
function EmployeeDashboard() {
  const [balance, setBalance] = useState({
    daysAllocated: 0,
    daysUsed: 0,
    daysRemaining: 0,
    pendingRequests: 0,
    upcomingLeave: 0
  })
  const [upcomingLeave, setUpcomingLeave] = useState<UpcomingLeave[]>([])
  const [myLeave, setMyLeave] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEmployeeData()
  }, [])

  const loadEmployeeData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const headers = {
        'Authorization': `Bearer ${token}`
      }

      // Load employee balance, upcoming leave, and my leave requests
      const [balanceRes, upcomingRes, myLeaveRes] = await Promise.all([
        fetch('/api/employee/balance', { headers }),
        fetch('/api/dashboard/upcoming-leave', { headers }),
        fetch('/api/employee/my-leave', { headers })
      ])

      if (balanceRes.ok) {
        const result = await balanceRes.json()
        if (result.success) setBalance(result.data)
      }

      if (upcomingRes.ok) {
        const result = await upcomingRes.json()
        if (result.success) setUpcomingLeave(result.data)
      }

      if (myLeaveRes.ok) {
        const result = await myLeaveRes.json()
        if (result.success) setMyLeave(result.leaveRequests || [])
      }
    } catch (error) {
      console.error('Error loading employee data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600">Manage your leave requests and view your balance</p>
      </div>

      {/* Employee stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Remaining Leave Days"
          value={balance.daysRemaining}
          icon="📅"
          color="blue"
        />
        <StatsCard
          title="Used This Year"
          value={balance.daysUsed}
          icon="✅"
          color="green"
        />
        <StatsCard
          title="Pending Requests"
          value={balance.pendingRequests}
          icon="⏳"
          color="yellow"
        />
        <StatsCard
          title="Upcoming Leave"
          value={balance.upcomingLeave}
          icon="🏖️"
          color="purple"
        />
      </div>

      {/* Quick actions for employees */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            className={`flex items-center p-4 rounded-lg transition-colors ${
              balance.daysRemaining > 0
                ? 'bg-blue-50 hover:bg-blue-100'
                : 'bg-gray-50 cursor-not-allowed'
            }`}
            disabled={balance.daysRemaining === 0}
          >
            <div className="text-2xl mr-3">➕</div>
            <div className="text-left">
              <h3 className="font-medium text-gray-900">Request Leave</h3>
              <p className="text-sm text-gray-600">
                {balance.daysRemaining > 0
                  ? 'Submit a new leave request'
                  : 'No leave days remaining'
                }
              </p>
            </div>
          </button>
          <button className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <div className="text-2xl mr-3">📊</div>
            <div className="text-left">
              <h3 className="font-medium text-gray-900">View My Leave</h3>
              <p className="text-sm text-gray-600">See all your leave requests</p>
            </div>
          </button>
        </div>
      </div>

      {/* My Leave Requests and Team Upcoming Leave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Recent Leave Requests */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            My Recent Leave Requests
          </h2>
          {!myLeave || myLeave.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No leave requests found
            </p>
          ) : (
            <div className="space-y-4">
              {(myLeave || []).slice(0, 5).map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm text-gray-600">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {leave.days} day{leave.days !== 1 ? 's' : ''} • {leave.reason}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      leave.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : leave.status === 'denied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {leave.status}
                    </span>
                  </div>
                </div>
              ))}
              {(myLeave || []).length > 5 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View all my requests →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Team Upcoming Leave */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Team Upcoming Leave
          </h2>
          {upcomingLeave.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No upcoming team leave scheduled
            </p>
          ) : (
            <div className="space-y-4">
              {upcomingLeave.slice(0, 5).map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {leave.full_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {leave.days} day{leave.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-blue-600 text-sm font-medium">
                    {Math.ceil((new Date(leave.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </div>
                </div>
              ))}
              {upcomingLeave.length > 5 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View all upcoming leave →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string
  value: string | number
  icon: string
  color: 'yellow' | 'green' | 'blue' | 'purple'
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]} border`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({ 
  title, 
  description, 
  icon, 
  href 
}: { 
  title: string
  description: string
  icon: string
  href: string
}) {
  return (
    <a
      href={href}
      className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex-shrink-0">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="ml-3">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="ml-auto">
        <span className="text-gray-400">→</span>
      </div>
    </a>
  )
}
