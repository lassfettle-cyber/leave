'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface LeaveBlock {
  id: string
  date: string // yyyy-mm-dd
  user: {
    id: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    position?: 'captain' | 'first_officer'
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

// Color palette for user leave blocks
const USER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600', ring: 'ring-blue-600' },
  { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-600' },
  { bg: 'bg-purple-500', text: 'text-purple-600', ring: 'ring-purple-600' },
  { bg: 'bg-pink-500', text: 'text-pink-600', ring: 'ring-pink-600' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', ring: 'ring-indigo-600' },
  { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-600' },
  { bg: 'bg-orange-500', text: 'text-orange-600', ring: 'ring-orange-600' },
  { bg: 'bg-teal-500', text: 'text-teal-600', ring: 'ring-teal-600' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', ring: 'ring-cyan-600' },
  { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-600' },
  { bg: 'bg-lime-500', text: 'text-lime-600', ring: 'ring-lime-600' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-600' },
  { bg: 'bg-sky-500', text: 'text-sky-600', ring: 'ring-sky-600' },
  { bg: 'bg-violet-500', text: 'text-violet-600', ring: 'ring-violet-600' },
  { bg: 'bg-fuchsia-500', text: 'text-fuchsia-600', ring: 'ring-fuchsia-600' },
  { bg: 'bg-rose-500', text: 'text-rose-600', ring: 'ring-rose-600' },
]

// Generate consistent color for a user based on their ID
function getUserColor(userId: string): typeof USER_COLORS[0] {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % USER_COLORS.length
  return USER_COLORS[index]
}

export default function LeaveCalendar({ viewType }: LeaveCalendarProps) {
  const router = useRouter()
  const [leaveBlocks, setLeaveBlocks] = useState<LeaveBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Initialize to 2026
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1))
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([])
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({})
  const holidaySet = useMemo(() => new Set(Object.keys(holidaysByDate)), [holidaysByDate])

  const handleUserClick = (userId: string) => {
    router.push(`/dashboard/users/${userId}/leave`)
  }

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

    // Limit to 2026 only
    if (newDate.getFullYear() < 2026) {
      newDate.setFullYear(2026)
      newDate.setMonth(0)
      newDate.setDate(1)
    } else if (newDate.getFullYear() > 2026) {
      newDate.setFullYear(2026)
      newDate.setMonth(11)
      newDate.setDate(31)
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
    // Group blocks by leave id AND user id to avoid conflicts
    const byKey = new Map<string, LeaveBlock[]>()
    for (const b of leaveBlocks) {
      const key = `${b.id}-${b.user.id}`
      const arr = byKey.get(key) || []
      arr.push(b)
      byKey.set(key, arr)
    }
    const segments: WeekSegment[] = []

    for (const [key, items] of Array.from(byKey.entries())) {
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
          id: first.id,
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

            // Calculate minimum height based on number of leave blocks
            const maxLeaveBlocks = segmentsForWeek.length
            const minHeight = Math.max(120, 40 + (maxLeaveBlocks * 28)) // 40px for day number + 28px per leave block

            return (
              <div key={wIdx} className="relative" style={{ minHeight: `${minHeight}px` }}>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0 h-full">
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
                        className={`relative h-full border-2 border-gray-400 p-1 ${bgClass}`}

                      >
                        <div className="relative z-20 text-right">
                          {isTodayDate ? (
                            <span className="inline-flex items-center justify-center bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">
                              {date.getDate()}
                            </span>
                          ) : (
                            <span className={`text-lg font-bold ${!isCurrentMonthDay && viewType === 'monthly' ? 'text-gray-400' : 'text-gray-700'}`}>
                              {date.getDate()}
                            </span>
                          )}
                        </div>

	                        {holidaysByDate[dateStr] && (
	                          <div className="mt-1 relative z-20">
	                            <span
	                              className="inline-block px-2 py-1 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold border border-amber-300 shadow-sm"
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
                <div className="absolute inset-0 z-10 grid grid-cols-7 auto-rows-[28px] pt-8">
                  {segmentsForWeek.map((seg, i) => {
                    const userColor = getUserColor(seg.user.id)
                    const positionIcon = seg.user.position === 'captain' ? '✈️' : seg.user.position === 'first_officer' ? '👨‍✈️' : ''
                    return (
                      <div
                        key={`${seg.id}-${i}`}
                        className="relative flex items-center h-6 mt-1 cursor-pointer"
                        style={{ gridColumn: `${seg.colStart} / span ${seg.colSpan}` }}
                        title={`${seg.user.fullName} (${seg.user.position === 'captain' ? 'Captain' : 'First Officer'}) - ${seg.reason}\nClick to view all leave`}
                        onClick={() => handleUserClick(seg.user.id)}
                      >
                        <div className={`w-full ${userColor.bg} opacity-65 text-white text-xs h-6 flex items-center ${seg.roundedLeft ? 'rounded-l-full' : 'rounded-none'} ${seg.roundedRight ? 'rounded-r-full' : 'rounded-none'} hover:opacity-80 transition-opacity shadow-sm`}>
                          <div className={`ml-2 mr-1 w-5 h-5 bg-white rounded-full flex items-center justify-center ${userColor.text} text-[10px] font-bold shadow-sm`}>
                            {seg.user.initials}
                          </div>
                          <span className="truncate pr-1 font-semibold">{seg.user.firstName}</span>
                          <span className="text-[10px] mr-1">{positionIcon}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
