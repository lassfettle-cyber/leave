"use client"

import React, { useEffect, useMemo, useState } from 'react'

type Holiday = {
  id: string | number
  holiday_date: string
  name: string
}

type SettingsResponse = {
  success: boolean
  settings: { id: number; excluded_weekdays: number[] }
  holidays: Holiday[]
}

const weekdayLabels = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [excluded, setExcluded] = useState<number[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])

  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')

  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null), [])

  useEffect(() => {
    async function load() {
      try {
        setError('')
        setSuccess('')
        const res = await fetch('/api/settings/leave', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data: SettingsResponse = await res.json()
        if (!res.ok || !data.success) {
          throw new Error((data as any).error || 'Failed to load settings')
        }
        setExcluded(data.settings?.excluded_weekdays || [])
        setHolidays(data.holidays || [])
      } catch (e: any) {
        setError(e.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const toggleWeekday = (idx: number) => {
    setExcluded(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])
  }

  const saveExcluded = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const res = await fetch('/api/settings/leave', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ excluded_weekdays: excluded })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSuccess('Settings saved')
    } catch (e: any) {
      setError(e.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError('')
      setSuccess('')
      const res = await fetch('/api/settings/leave/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ holiday_date: newHolidayDate, name: newHolidayName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add holiday')
      setHolidays(prev => {
        const others = prev.filter(h => h.holiday_date !== data.holiday.holiday_date)
        return [...others, data.holiday].sort((a,b) => a.holiday_date.localeCompare(b.holiday_date))
      })
      setNewHolidayDate('')
      setNewHolidayName('')
      setSuccess('Holiday added')
    } catch (e: any) {
      setError(e.message || 'Failed to add holiday')
    }
  }

  const deleteHoliday = async (id: string | number) => {
    try {
      setError('')
      setSuccess('')
      const res = await fetch(`/api/settings/leave/holidays/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete holiday')
      setHolidays(prev => prev.filter(h => h.id !== id))
      setSuccess('Holiday deleted')
    } catch (e: any) {
      setError(e.message || 'Failed to delete holiday')
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure leave calculation rules</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">{success}</div>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Excluded Weekdays</h2>
        <p className="text-sm text-gray-600">Days selected here will not count towards leave days.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {weekdayLabels.map((label, idx) => (
            <label key={idx} className="flex items-center space-x-2 p-2 border rounded-md">
              <input
                type="checkbox"
                checked={excluded.includes(idx)}
                onChange={() => toggleWeekday(idx)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div>
          <button
            onClick={saveExcluded}
            disabled={saving}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Holidays</h2>
        <p className="text-sm text-gray-600">Add holidays to exclude from leave days.</p>

        <form onSubmit={addHoliday} className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {holidays.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600" colSpan={3}>No holidays</td>
                </tr>
              )}
              {holidays.map(h => (
                <tr key={h.id}>
                  <td className="px-4 py-3 text-sm">{h.holiday_date}</td>
                  <td className="px-4 py-3 text-sm">{h.name}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => deleteHoliday(h.id)}
                      className="text-red-600 hover:text-red-800"
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

