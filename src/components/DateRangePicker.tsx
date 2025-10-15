"use client"

import { useEffect, useMemo, useState } from 'react'

type Props = {
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  onChange: (startDate: string | undefined, endDate: string | undefined) => void
  disabledDates?: Set<string> | string[]
  minDate?: string // YYYY-MM-DD
}

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
const weekdayShort = ['Su','Mo','Tu','We','Th','Fr','Sa']

function toDateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDaysUTC(d: Date, days: number) {
  const nd = new Date(d)
  nd.setUTCDate(nd.getUTCDate() + days)
  return nd
}

function isBefore(a: Date, b: Date) { return a.getTime() < b.getTime() }
function isAfter(a: Date, b: Date) { return a.getTime() > b.getTime() }

export default function DateRangePicker({ startDate, endDate, onChange, disabledDates, minDate }: Props) {
  const disabled = useMemo(() => {
    if (!disabledDates) return new Set<string>()
    return new Set<string>(Array.isArray(disabledDates) ? disabledDates : Array.from(disabledDates))
  }, [disabledDates])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const min = useMemo(() => minDate || todayStr, [minDate, todayStr])

  const [cursor, setCursor] = useState(() => {
    const base = startDate ? new Date(startDate) : new Date()
    // Limit to 2026
    const year = base.getUTCFullYear() === 2026 ? 2026 : 2026
    return { year, month: base.getUTCMonth() }
  })

  const start = startDate ? toDateOnly(new Date(startDate)) : undefined
  const end = endDate ? toDateOnly(new Date(endDate)) : undefined
  const minD = toDateOnly(new Date(min))

  const isDisabled = (d: Date) => {
    const s = fmt(d)
    // Disable dates outside 2026
    if (d.getUTCFullYear() !== 2026) return true
    if (isBefore(d, minD)) return true
    return disabled.has(s)
  }

  const rangeHasDisabled = (a: Date, b: Date) => {
    let cur = new Date(a)
    while (cur.getTime() <= b.getTime()) {
      if (isDisabled(cur)) return true
      cur = addDaysUTC(cur, 1)
    }
    return false
  }

  const onDayClick = (d: Date) => {
    if (isDisabled(d)) return
    if (!start || (start && end)) {
      onChange(fmt(d), undefined)
      return
    }
    // start set, end not set
    if (isBefore(d, start)) {
      onChange(fmt(d), undefined)
      return
    }
    // ensure no disabled day in range
    if (rangeHasDisabled(start, d)) return

    // Enforce minimum 14 consecutive days
    const daysDiff = Math.ceil((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff < 14) {
      alert('Minimum booking is 14 consecutive days')
      return
    }

    onChange(fmt(start), fmt(d))
  }

  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1))
    const firstDow = first.getUTCDay() // 0..6
    const prevMonthLast = addDaysUTC(first, -1)
    const prevMonthDays = prevMonthLast.getUTCDate()
    const startPrev = prevMonthDays - firstDow + 1
    const grid: Array<{ date: Date; inMonth: boolean }>[] = []
    let cur = 0
    for (let r = 0; r < 6; r++) {
      const row: { date: Date; inMonth: boolean }[] = []
      for (let c = 0; c < 7; c++) {
        const dayIndex = r*7 + c
        let date: Date
        let inMonth = true
        if (dayIndex < firstDow) {
          date = new Date(Date.UTC(cursor.year, cursor.month - 1, startPrev + dayIndex))
          inMonth = false
        } else {
          const dnum = dayIndex - firstDow + 1
          date = new Date(Date.UTC(cursor.year, cursor.month, dnum))
          inMonth = date.getUTCMonth() === cursor.month
        }
        row.push({ date, inMonth })
        cur++
      }
      grid.push(row)
    }
    return grid
  }, [cursor])

  const isInRange = (d: Date) => {
    if (!start || !end) return false
    return !isBefore(d, start) && !isAfter(d, end)
  }

  const isStart = (d: Date) => start && d.getTime() === start.getTime()
  const isEnd = (d: Date) => end && d.getTime() === end.getTime()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={cursor.year === 2026 && cursor.month === 0}
          onClick={() => {
            const m = cursor.month - 1
            if (m < 0 && cursor.year === 2026) return // Don't go before Jan 2026
            const y = m < 0 ? cursor.year - 1 : cursor.year
            const nm = (m + 12) % 12
            if (y < 2026) return // Don't go before 2026
            setCursor({ year: y, month: nm })
          }}
        >‹</button>
        <div className="font-medium">{monthNames[cursor.month]} {cursor.year}</div>
        <button
          type="button"
          className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={cursor.year === 2026 && cursor.month === 11}
          onClick={() => {
            const m = cursor.month + 1
            if (m > 11 && cursor.year === 2026) return // Don't go after Dec 2026
            const y = m > 11 ? cursor.year + 1 : cursor.year
            const nm = m % 12
            if (y > 2026) return // Don't go after 2026
            setCursor({ year: y, month: nm })
          }}
        >›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500">
        {weekdayShort.map((w) => (
          <div key={w} className="text-center py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((row, ri) => (
          <>
            {row.map(({ date, inMonth }, ci) => {
              const ds = fmt(date)
              const disabledCell = !inMonth || isDisabled(date)
              const selected = isInRange(date)
              const startSel = isStart(date)
              const endSel = isEnd(date)
              return (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  onClick={() => onDayClick(date)}
                  disabled={disabledCell}
                  className={[
                    'h-9 text-sm rounded-md border flex items-center justify-center',
                    inMonth ? '' : 'text-gray-300',
                    disabledCell ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50',
                    selected ? 'bg-blue-100 border-blue-300' : 'bg-white',
                    (startSel || endSel) ? 'ring-2 ring-blue-500 font-semibold' : '',
                  ].join(' ')}
                >
                  {date.getUTCDate()}
                </button>
              )
            })}
          </>
        ))}
      </div>

      <div className="text-xs text-gray-600">
        {startDate && !endDate && <span>Select an end date…</span>}
        {startDate && endDate && <span>Selected: {startDate} → {endDate}</span>}
        {!startDate && !endDate && <span>Select a start date…</span>}
      </div>

      <div className="flex gap-2">
        <button type="button" className="text-xs text-gray-600 hover:text-gray-800 underline" onClick={() => onChange(undefined, undefined)}>Clear selection</button>
      </div>
    </div>
  )
}

