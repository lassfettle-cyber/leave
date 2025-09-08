'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LeaveRequestForm from '@/components/LeaveRequestForm'
import type { LeaveRequest } from '@/types/database'

interface LeaveBalance {
  allocated: number
  used: number
  remaining: number
}

export default function LeaveRequestsPage() {
  const { user } = useAuth()
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)

  useEffect(() => {
    loadLeaveRequests()
  }, [])

  const loadLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/employee/my-leave', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setLeaveRequests(result.leaveRequests || [])
        setLeaveBalance(result.leaveBalance || null)
      } else {
        setError('Failed to load leave requests')
      }
    } catch (error) {
      console.error('Error loading leave requests:', error)
      setError('An error occurred while loading leave requests')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSuccess = () => {
    setShowRequestForm(false)
    setSuccess('Leave request submitted successfully!')
    setError('')
    loadLeaveRequests()
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`/api/leave-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setSuccess('Leave request cancelled successfully')
        setError('')
        loadLeaveRequests()
      } else {
        const result = await response.json()
        setError(result.error || 'Failed to cancel leave request')
      }
    } catch (error) {
      console.error('Error cancelling leave request:', error)
      setError('An error occurred while cancelling the request')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'denied':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Leave Requests</h1>
        <button
          onClick={() => setShowRequestForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
        >
          Request Leave
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Leave Balance Card */}
      {leaveBalance && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Leave Balance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{leaveBalance.allocated}</div>
              <div className="text-sm text-gray-500">Allocated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{leaveBalance.used}</div>
              <div className="text-sm text-gray-500">Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{leaveBalance.remaining}</div>
              <div className="text-sm text-gray-500">Remaining</div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {leaveRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">📅</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leave requests</h3>
            <p className="text-gray-500 mb-4">You haven't submitted any leave requests yet.</p>
            <button
              onClick={() => setShowRequestForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
            >
              Request Your First Leave
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {leaveRequests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(request.start_date)} - {formatDate(request.end_date)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {request.days} day{request.days !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleCancelRequest(request.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">{request.reason}</p>
                    </div>
                    {request.admin_notes && (
                      <div className="mt-2 bg-gray-50 rounded-md p-2">
                        <p className="text-xs text-gray-500 font-medium">Admin Notes:</p>
                        <p className="text-sm text-gray-700">{request.admin_notes}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-xs text-gray-400">
                        Submitted on {formatDate(request.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <LeaveRequestForm
          onSuccess={handleRequestSuccess}
          onCancel={() => setShowRequestForm(false)}
        />
      )}
    </div>
  )
}
