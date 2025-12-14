'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ReminderCandidate {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  email: string
  days_allocated: number
  days_used: number
  days_remaining: number
  year: number
}

export default function RemindersPage() {
  const router = useRouter()
  const [reminders, setReminders] = useState<ReminderCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/dashboard/reminders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setReminders(data.data || [])
      } else {
        setError(data.error || 'Failed to load reminders')
      }
    } catch (error) {
      console.error('Error loading reminders:', error)
      setError('An error occurred while loading reminders')
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = async (userId: string, email: string, name: string) => {
    if (!confirm(`Send reminder email to ${name}?`)) return

    try {
      setSendingReminder(userId)
      const token = localStorage.getItem('auth_token')
      
      const response = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        alert(`Reminder sent successfully to ${name}`)
      } else {
        alert(data.error || 'Failed to send reminder')
      }
    } catch (error) {
      console.error('Error sending reminder:', error)
      alert('An error occurred while sending reminder')
    } finally {
      setSendingReminder(null)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Leave Reminders</h1>
          <p className="text-gray-600 mt-1">Employees with remaining leave days who should be reminded to apply</p>
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
          {reminders.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No employees need reminders at this time.
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
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Allocated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reminders.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{reminder.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{reminder.email}</div>
                        <div className="text-sm text-gray-500">{reminder.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {reminder.days_allocated} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {reminder.days_used} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {reminder.days_remaining} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleSendReminder(reminder.id, reminder.email, reminder.full_name)}
                          disabled={sendingReminder === reminder.id}
                          className={`px-4 py-2 rounded-md ${
                            sendingReminder === reminder.id
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-yellow-600 text-white hover:bg-yellow-700'
                          }`}
                        >
                          {sendingReminder === reminder.id ? 'Sending...' : 'Send Reminder'}
                        </button>
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


