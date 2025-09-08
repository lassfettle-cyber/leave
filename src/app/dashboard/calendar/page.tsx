'use client'

import { useState } from 'react'
import LeaveCalendar from '@/components/LeaveCalendar'

export default function CalendarPage() {
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Leave Calendar</h1>
        
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
    </div>
  )
}
