'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LeaveCalendar from '@/components/LeaveCalendar'
import AddLeaveModal from '@/components/AddLeaveModal'

export default function CalendarPage() {
  const { user } = useAuth()
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly')
  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = user?.profile?.role === 'admin'

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true)
      setError('')

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch('/api/calendar/export', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `approved-leave-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setSuccess('✅ Leave data exported successfully!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Failed to export leave data')
      }
    } catch (error) {
      console.error('Error exporting leave data:', error)
      setError('An error occurred while exporting leave data')
    } finally {
      setExportLoading(false)
    }
  }

  const handleAddLeaveSuccess = () => {
    setShowAddLeaveModal(false)
    setSuccess('✅ Leave added successfully!')
    setTimeout(() => setSuccess(''), 3000)
    // Reload the calendar
    window.location.reload()
  }

  return (
    <div className="space-y-6">
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

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Leave Calendar</h1>

        <div className="flex items-center gap-3">
          {/* Admin Actions */}
          {isAdmin && (
            <>
              <button
                onClick={() => setShowAddLeaveModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium text-sm"
              >
                + Add Leave for User
              </button>
              <button
                onClick={handleExportToExcel}
                disabled={exportLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportLoading ? 'Exporting...' : '📊 Export to Excel'}
              </button>
            </>
          )}

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewType('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewType === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewType('weekly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewType === 'weekly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Component */}
      <LeaveCalendar viewType={viewType} />

      {/* Legend */}
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-teal-500 rounded"></div>
            <span className="text-gray-600">Approved Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-gray-600">Today</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span className="text-gray-600">Previous/Next Month</span>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          <p>• Hover over leave blocks to see full details</p>
          <p>• Only approved leave requests are displayed</p>
          <p>• Weekends are excluded from leave calculations</p>
        </div>
      </div>

      {/* Add Leave Modal */}
      {showAddLeaveModal && (
        <AddLeaveModal
          onSuccess={handleAddLeaveSuccess}
          onCancel={() => setShowAddLeaveModal(false)}
        />
      )}
    </div>
  )
}
