'use client'

import { useEffect, useState } from 'react'
import DateRangePicker from './DateRangePicker'

interface AddLeaveModalProps {
  onSuccess: () => void
  onCancel: () => void
}

interface User {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  position: string
  daysAllocated: number
  daysUsed: number
  daysRemaining: number
}

interface ExpiredInviteUser {
  inviteId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  position: string
  daysAllocated: number
  expiresAt: string
}

export default function AddLeaveModal({ onSuccess, onCancel }: AddLeaveModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [expiredInviteUsers, setExpiredInviteUsers] = useState<ExpiredInviteUser[]>([])
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    reason: ''
  })
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([])
  const [holidays, setHolidays] = useState<Array<{ holiday_date: string; name: string }>>([])
  const [disabledDates, setDisabledDates] = useState<Set<string>>(new Set())
  const [positionCapacityDates, setPositionCapacityDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUsersAndSettings()
  }, [])

  // Fetch position capacity when user is selected
  useEffect(() => {
    if (formData.userId) {
      loadPositionCapacity()
    } else {
      setPositionCapacityDates(new Set())
    }
  }, [formData.userId])

  const loadUsersAndSettings = async () => {
    try {
      setLoadingUsers(true)
      const token = localStorage.getItem('auth_token')
      if (!token) return

      // Fetch users with remaining days and settings
      const [usersRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users-with-remaining-days', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/settings/leave', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        if (usersData.success) {
          setUsers(usersData.usersWithRemainingDays || [])
          setExpiredInviteUsers(usersData.usersWithExpiredInvites || [])
        }
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.success) {
          setExcludedWeekdays(settingsData.settings.excludedWeekdays || [])
          setHolidays(settingsData.holidays || [])
        }
      }
    } catch (error) {
      console.error('Error loading users and settings:', error)
      setError('Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadPositionCapacity = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const selectedUser = users.find(u => u.id === formData.userId)
      if (!selectedUser || !selectedUser.position) return

      const response = await fetch(
        `/api/admin/position-capacity?position=${selectedUser.position}&userId=${selectedUser.id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPositionCapacityDates(new Set(data.disabledDates || []))
        }
      }
    } catch (error) {
      console.error('Error loading position capacity:', error)
    }
  }

  // Build disabled dates based on excluded weekdays, holidays, and position capacity
  useEffect(() => {
    const disabled = new Set<string>()

    // Add holidays
    holidays.forEach(h => {
      disabled.add(h.holiday_date)
    })

    // Add excluded weekdays for the year 2026
    if (excludedWeekdays.length > 0) {
      const start = new Date('2026-01-01')
      const end = new Date('2026-12-31')
      const current = new Date(start)

      while (current <= end) {
        if (excludedWeekdays.includes(current.getDay())) {
          disabled.add(current.toISOString().split('T')[0])
        }
        current.setDate(current.getDate() + 1)
      }
    }

    // Add position capacity dates (dates with 5 captains or 5 first officers)
    positionCapacityDates.forEach(date => {
      disabled.add(date)
    })

    setDisabledDates(disabled)
  }, [excludedWeekdays, holidays, positionCapacityDates])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      if (!formData.userId || !formData.startDate || !formData.endDate) {
        setError('Please select a user and date range')
        return
      }

      const response = await fetch('/api/admin/add-leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Failed to add leave')
      }
    } catch (error) {
      console.error('Error adding leave:', error)
      setError('An error occurred while adding leave')
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find(u => u.id === formData.userId)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Add Leave for User</h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {loadingUsers ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading users...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select User *
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a user --</option>
                  {users.length > 0 && (
                    <optgroup label="Users with Remaining Leave Days">
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.email}) - {user.daysRemaining} days remaining
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {expiredInviteUsers.length > 0 && (
                    <optgroup label="Users with Expired Invites (Not Registered)">
                      {expiredInviteUsers.map(user => (
                        <option key={user.inviteId} value="" disabled>
                          {user.fullName} ({user.email}) - Invite expired, cannot add leave
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {selectedUser && (
                  <p className="mt-1 text-sm text-gray-600">
                    Position: {selectedUser.position?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} | 
                    Allocated: {selectedUser.daysAllocated} days | 
                    Used: {selectedUser.daysUsed} days | 
                    Remaining: <span className="font-semibold text-green-600">{selectedUser.daysRemaining} days</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date Range *
                </label>
                <DateRangePicker
                  startDate={formData.startDate || undefined}
                  endDate={formData.endDate || undefined}
                  onChange={(s, e) => setFormData(prev => ({ ...prev, startDate: s || '', endDate: e || '' }))}
                  disabledDates={disabledDates}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (Optional)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter reason for leave (optional)"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.userId || !formData.startDate || !formData.endDate}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding Leave...' : 'Add Leave'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

