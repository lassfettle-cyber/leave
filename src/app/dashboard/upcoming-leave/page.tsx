'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UpcomingLeave {
  id: string
  userId: string
  userName: string
  userEmail: string
  position?: 'captain' | 'first_officer'
  startDate: string
  endDate: string
  days: number
  reason: string
}

export default function UpcomingLeavePage() {
  const router = useRouter()
  const [upcomingLeave, setUpcomingLeave] = useState<UpcomingLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUpcomingLeave()
  }, [])

  const loadUpcomingLeave = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/dashboard/upcoming-leave', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUpcomingLeave(data.upcomingLeave || [])
      } else {
        setError(data.error || 'Failed to load upcoming leave')
      }
    } catch (error) {
      console.error('Error loading upcoming leave:', error)
      setError('An error occurred while loading upcoming leave')
    } finally {
      setLoading(false)
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

  const handleUserClick = (userId: string) => {
    router.push(`/dashboard/users/${userId}/leave`)
  }

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

        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900">All Upcoming Leave</h1>
          <p className="text-gray-600 mt-1">View all approved leave requests starting from today</p>
        </div>
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
        <div className="bg-white shadow rounded-lg">
          {upcomingLeave.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No upcoming leave found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {upcomingLeave.map((leave) => (
                    <tr
                      key={leave.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleUserClick(leave.userId)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{leave.userName}</div>
                          <div className="text-sm text-gray-500">{leave.userEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPositionBadge(leave.position)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(leave.startDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(leave.endDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leave.days}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {leave.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

