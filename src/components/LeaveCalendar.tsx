'use client'

import { useState, useEffect, useMemo } from 'react'

interface LeaveBlock {
  id: string
  date: string // yyyy-mm-dd
  user: {
    id: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    initials: string
  }
  reason: string
  isStart: boolean
  isEnd: boolean
  totalDays: number
}

type WeekKey = string // yyyy-mm-dd of the week's Sunday

interface WeekSegment {
  id: string
  user: LeaveBlock['user']
  reason: string
  startDate: Date
  endDate: Date
  weekKey: WeekKey
  colStart: number // 1..7 (Sun..Sat)
  colSpan: number // 1..7
  roundedLeft: boolean
  roundedRight: boolean
}

interface LeaveCalendarProps {
  viewType: 'monthly' | 'weekly'
}

export default function LeaveCalendar({ viewType }: LeaveCalendarProps) {
  const [leaveBlocks, setLeaveBlocks] = useState<LeaveBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([])
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({})
  const holidaySet = useMemo(() => new Set(Object.keys(holidaysByDate)), [holidaysByDate])

  // Load settings once (excluded weekdays and holidays)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/settings/leave', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setExcludedWeekdays(data.settings?.excluded_weekdays || [])
          const byDate: Record<string, string> = {}
          ;(data.holidays || []).forEach((h: any) => { byDate[h.holiday_date] = h.name })
          setHolidaysByDate(byDate)
        }
      } catch {}
    })()
  }, [])

  // Reload leave data when date range or view changes
  useEffect(() => {
    loadLeaveData()
  }, [currentDate, viewType])

  const loadLeaveData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) return

      // Calculate date range based on view type
      const { startDate, endDate } = getDateRange()

      const response = await fetch(
        `/api/calendar/leave-requests?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.ok) {
        const result = await response.json()
        setLeaveBlocks(result.leaveBlocks || [])
      } else {
        setError('Failed to load calendar data')
      }
    } catch (error) {
      console.error('Error loading calendar data:', error)
      setError('An error occurred while loading calendar data')
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    if (viewType === 'weekly') {
      // Get start of week (Monday) and end of week (Sunday)
      const startOfWeek = new Date(currentDate)
      const w = (startOfWeek.getDay() + 6) % 7 // 0=Mon..6=Sun
      startOfWeek.setDate(startOfWeek.getDate() - w)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0]
      }
    } else {
      // Monthly view
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      return {
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      }
    }
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)

    if (viewType === 'weekly') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    }

    setCurrentDate(newDate)
  }

  const getCalendarDays = () => {
    if (viewType === 'weekly') {
      return getWeekDays()
    } else {
      return getMonthDays()
    }
  }

  const getWeekDays = () => {
    const days = []
    const startOfWeek = new Date(currentDate)
    const w = (startOfWeek.getDay() + 6) % 7 // 0=Mon..6=Sun
    startOfWeek.setDate(startOfWeek.getDate() - w)

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }

    return days
  }

  const getMonthDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // First day of month
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    const startOffset = (firstDay.getDay() + 6) % 7 // 0=Mon..6=Sun
    startDate.setDate(firstDay.getDate() - startOffset) // Start from Monday

    // Last day of month
    const lastDay = new Date(year, month + 1, 0)
    const endDate = new Date(lastDay)
    const endOffset = 6 - ((lastDay.getDay() + 6) % 7) // go to Sunday
    endDate.setDate(lastDay.getDate() + endOffset)

    const days = []
    const currentDay = new Date(startDate)

    while (currentDay <= endDate) {
      days.push(new Date(currentDay))
      currentDay.setDate(currentDay.getDate() + 1)
    }

    return days
  }

  const getLeaveBlocksForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return leaveBlocks.filter(block => block.date === dateString)
  }

  // Helpers to compute continuous segments per week (Monday as first day)
  const startOfWeek = (d: Date) => {
    const s = new Date(d)
    s.setHours(0,0,0,0)
    const w = (s.getDay() + 6) % 7 // 0=Mon..6=Sun
    s.setDate(s.getDate() - w)
    return s
  }
  const weekKeyOf = (d: Date): WeekKey => startOfWeek(d).toISOString().split('T')[0]

  const weekSegments = useMemo<WeekSegment[]>(() => {
    // Group blocks by leave id
    const byId = new Map<string, LeaveBlock[]>()
    for (const b of leaveBlocks) {
      const arr = byId.get(b.id) || []
      arr.push(b)
      byId.set(b.id, arr)
    }
    const segments: WeekSegment[] = []

    for (const [id, items] of Array.from(byId.entries())) {
      // sort by date
      items.sort((a: LeaveBlock, b: LeaveBlock) => a.date.localeCompare(b.date))
      const firstStrAll = items[0]?.date
      const lastStrAll = items[items.length - 1]?.date
      let i = 0
      while (i < items.length) {
        const first = items[i]
        let endDate = new Date(first.date)
        const wk = weekKeyOf(new Date(first.date))
        let span = 1
        let j = i + 1
        while (j < items.length) {
          const next = items[j]
          const nextDate = new Date(next.date)
          // stop if week changes or day not consecutive
          const sameWeek = weekKeyOf(nextDate) === wk
          const isConsecutive = (nextDate.getTime() - endDate.getTime()) === 24*60*60*1000
          if (!sameWeek || !isConsecutive) break
          endDate = nextDate
          span += 1
          j++
        }
        const colStart = ((new Date(first.date).getDay() + 6) % 7) + 1 // Mon=1..Sun=7
        const colSpan = span // allow spanning through Sunday if present
        const endStr = new Date(endDate).toISOString().split('T')[0]
        const roundedLeft = first.date === firstStrAll
        const roundedRight = endStr === lastStrAll

        segments.push({
          id,
          user: first.user,
          reason: first.reason,
          startDate: new Date(first.date),
          endDate: new Date(endDate),
          weekKey: wk,
          colStart,
          colSpan,
          roundedLeft,
          roundedRight
        })
        i = j
      }
    }
    return segments
  }, [leaveBlocks])

  const formatDateHeader = () => {
    if (viewType === 'weekly') {
      const startOfWeek = new Date(currentDate)
      const w = (startOfWeek.getDay() + 6) % 7 // 0=Mon..6=Sun
      startOfWeek.setDate(startOfWeek.getDate() - w)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const calendarDays = getCalendarDays()
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weeks: Date[][] = useMemo(() => {
    const arr: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      arr.push(calendarDays.slice(i, i + 7))
    }
    return arr
  }, [calendarDays])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <button
          onClick={() => navigateDate('prev')}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {formatDateHeader()}
        </h2>
        <button
          onClick={() => navigateDate('next')}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-0 mb-2">
          {daysOfWeek.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-gray-200 border border-gray-300" />
            <span>Excluded day</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Holiday</span>
            <span>Excluded</span>
          </div>
        </div>


        {/* Calendar weeks */}
        <div className="space-y-0">
          {weeks.map((week, wIdx) => {
            const wkKey: WeekKey = weekKeyOf(week[0])
            const segmentsForWeek = weekSegments.filter(s => s.weekKey === wkKey)

            return (
              <div key={wIdx} className="relative">
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0">
                  {week.map((date, index) => {
                    const isCurrentMonthDay = isCurrentMonth(date)
                    const isTodayDate = isToday(date)
                    const dateStr = date.toISOString().split('T')[0]
                    const isExcluded = excludedWeekdays.includes(date.getDay()) || holidaySet.has(dateStr)
                    const bgClass = !isCurrentMonthDay && viewType === 'monthly'
                      ? 'bg-gray-50'
                      : (isExcluded ? 'bg-gray-100' : 'bg-white')
                    return (
                      <div
                        key={index}
                        className={`min-h-[120px] border border-gray-200 p-1 ${bgClass}`}

                      >
                        <div className="text-sm font-medium">
                          {isTodayDate ? (
                            <span className="inline-flex items-center justify-center bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">
                              {date.getDate()}
                            </span>
                          ) : (
                            <span className={`${!isCurrentMonthDay && viewType === 'monthly' ? 'text-gray-400' : 'text-gray-900'}`}>
                              {date.getDate()}
                            </span>
                          )}
                        </div>

	                        {holidaysByDate[dateStr] && (
	                          <div className="mt-1">
	                            <span
	                              className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] border border-amber-200"
	                              title={holidaysByDate[dateStr]}
	                            >
	                              {holidaysByDate[dateStr]}
	                            </span>
	                          </div>
	                        )}

                      </div>


                    )
                  })}
                </div>

                {/* Overlay: continuous leave bars for this week */}
                <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-7 auto-rows-[24px]">
                  {segmentsForWeek.map((seg, i) => (
                    <div
                      key={`${seg.id}-${i}`}
                      className="relative flex items-center h-6 mt-6"


                      style={{ gridColumn: `${seg.colStart} / span ${seg.colSpan}` }}
                      title={`${seg.user.fullName} - ${seg.reason}`}
                    >
                      <div className={`w-full bg-teal-500 text-white text-xs h-6 flex items-center ${seg.roundedLeft ? 'rounded-l-full' : 'rounded-none'} ${seg.roundedRight ? 'rounded-r-full' : 'rounded-none'}`}>
                        <div className="ml-2 mr-2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-teal-600 text-[10px] font-bold">
                          {seg.user.initials}
                        </div>
                        <span className="truncate pr-2">{seg.user.firstName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
