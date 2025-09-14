'use client'

import { useEffect, useMemo, useState } from 'react'
import DateRangePicker from './DateRangePicker'

interface LeaveRequestFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function LeaveRequestForm({ onSuccess, onCancel }: LeaveRequestFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  })
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([])
  const [holidays, setHolidays] = useState<Array<{ holiday_date: string; name: string }>>([])
  const [disabledDates, setDisabledDates] = useState<Set<string>>(new Set())

  // Load settings and user's existing leave to build disabled calendar dates
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        // Fetch settings
        const [resSettings, resMyLeave] = await Promise.all([
          fetch('/api/settings/leave', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/employee/my-leave', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const dataSettings = await resSettings.json()
        if (resSettings.ok && dataSettings.success) {
          setExcludedWeekdays(dataSettings.settings?.excluded_weekdays || [])
          setHolidays(dataSettings.holidays || [])
        }
        const dataMyLeave = await resMyLeave.json()
        if (resMyLeave.ok && dataMyLeave.success) {
          const disabled = new Set<string>()
          const requests = (dataMyLeave.leaveRequests || []) as Array<{ start_date: string; end_date: string; status: string }>
          const active = requests.filter(r => r.status === 'pending' || r.status === 'approved')
          for (const r of active) {
            const s = new Date(r.start_date)
            const e = new Date(r.end_date)
            // iterate inclusive range in UTC
            const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
            const end = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()))
            while (cur.getTime() <= end.getTime()) {
              disabled.add(cur.toISOString().split('T')[0])
              cur.setUTCDate(cur.getUTCDate() + 1)
            }
          }
          setDisabledDates(disabled)
        }
      } catch {
        // ignore
      }
    })()
  }, [])


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

      const response = await fetch('/api/leave-requests/create', {
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
        setError(result.error || 'Failed to submit leave request')
      }
    } catch (error) {
      console.error('Error submitting leave request:', error)
      setError('An error occurred while submitting your request')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Calculate working days for preview using settings (excluded weekdays and holidays)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    const startUTC = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
    const endUTC = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()))
    let count = 0
    const current = new Date(startUTC)
    const holidaySet = new Set(holidays.map((h) => h.holiday_date))
    while (current.getTime() <= endUTC.getTime()) {
      const dayOfWeek = current.getUTCDay() // 0=Sun..6=Sat
      const dateStr = current.toISOString().split('T')[0]
      if (!excludedWeekdays.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
        count++
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return count
  }

  const workingDays = calculateWorkingDays(formData.startDate, formData.endDate)

  // Build a dynamic summary of exclusions within the selected period
  const excludedSummary = useMemo(() => {
    const { startDate, endDate } = formData
    if (!startDate || !endDate) return ''
    const s = new Date(startDate)
    const e = new Date(endDate)
    const startUTC = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
    const endUTC = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()))

    // Weekday names aligned with getUTCDay()
    const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

    // Which excluded weekdays actually occur in the selected range
    const occurred = new Set<number>()
    const d = new Date(startUTC)
    while (d.getTime() <= endUTC.getTime()) {
      const dow = d.getUTCDay()
      if (excludedWeekdays.includes(dow)) occurred.add(dow)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const occurredWeekdayNames = Array.from(occurred).sort((a,b)=>a-b).map(i => weekdayNames[i])

    // Holidays within range
    const holidaysInRange = holidays.filter(h => h.holiday_date >= startDate && h.holiday_date <= endDate)

    const parts: string[] = []
    if (occurredWeekdayNames.length) parts.push(`Weekdays: ${occurredWeekdayNames.join(', ')}`)
    if (holidaysInRange.length) parts.push(`Holidays: ${holidaysInRange.map(h => `${h.holiday_date} ${h.name}`).join('; ')}`)

    return parts.join(' | ')
  }, [formData.startDate, formData.endDate, excludedWeekdays, holidays])

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Request Leave</h3>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select date range
              </label>
              <DateRangePicker
                startDate={formData.startDate || undefined}
                endDate={formData.endDate || undefined}
                onChange={(s, e) => setFormData(prev => ({ ...prev, startDate: s || '', endDate: e || '' }))}
                disabledDates={disabledDates}
                minDate={new Date().toISOString().split('T')[0]}
              />
            </div>

            {workingDays > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-700">
                  <strong>Working days:</strong> {workingDays} day{workingDays !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {excludedSummary ? `Excluded this period: ${excludedSummary}` : '(No exclusions configured in this period)'}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                Reason
              </label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                placeholder="Please provide a reason for your leave request..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.startDate || !formData.endDate}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
