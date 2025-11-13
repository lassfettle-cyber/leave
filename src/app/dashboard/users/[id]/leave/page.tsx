'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface LeaveRequest {
  id: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
}

interface User {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  position?: 'captain' | 'first_officer'
  role: string
}

export default function UserLeavePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUserLeave()
  }, [userId])

  const loadUserLeave = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/users/${userId}/leave`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUser(data.user)
        setLeaveRequests(data.leaveRequests)
      } else {
        setError(data.error || 'Failed to load user leave')
      }
    } catch (error) {
      console.error('Error loading user leave:', error)
      setError('An error occurred while loading user leave')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
      case 'denied':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Denied</span>
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPositionBadge = (position?: string) => {
    if (position === 'captain') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">✈️ Captain</span>
    } else if (position === 'first_officer') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">👨‍✈️ First Officer</span>
    }
    return null
  }

  // Group leave by status
  const approvedLeave = leaveRequests.filter(req => req.status === 'approved')
  const pendingLeave = leaveRequests.filter(req => req.status === 'pending')
  const deniedLeave = leaveRequests.filter(req => req.status === 'denied')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
        >
          ← Back
        </button>

        {user && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
                <p className="text-gray-600">{user.email}</p>
              </div>
              <div className="flex gap-2">
                {getPositionBadge(user.position)}
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                  {user.role === 'admin' ? 'Admin' : 'Employee'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Leave Requests</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{leaveRequests.length}</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Approved</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">{approvedLeave.length}</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Pending</h3>
              <p className="mt-2 text-3xl font-bold text-yellow-600">{pendingLeave.length}</p>
            </div>
          </div>

          {/* Approved Leave */}
          {approvedLeave.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Approved Leave</h2>
              <div className="space-y-3">
                {approvedLeave.map(request => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </span>
                          <span className="text-sm text-gray-500">({request.days} days)</span>
                          {getStatusBadge(request.status)}
                        </div>
                        {request.reason && <p className="text-sm text-gray-600 mt-1">{request.reason}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Leave */}
          {pendingLeave.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Leave</h2>
              <div className="space-y-3">
                {pendingLeave.map(request => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </span>
                          <span className="text-sm text-gray-500">({request.days} days)</span>
                          {getStatusBadge(request.status)}
                        </div>
                        {request.reason && <p className="text-sm text-gray-600 mt-1">{request.reason}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Denied Leave */}
          {deniedLeave.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Denied Leave</h2>
              <div className="space-y-3">
                {deniedLeave.map(request => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </span>
                          <span className="text-sm text-gray-500">({request.days} days)</span>
                          {getStatusBadge(request.status)}
                        </div>
                        {request.reason && <p className="text-sm text-gray-600 mt-1">{request.reason}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaveRequests.length === 0 && (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No leave requests found for this user.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

