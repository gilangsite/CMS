'use client'

import { CalendarDays, Clock } from 'lucide-react'

interface SchedulePickerProps {
  value: Date | null
  onChange: (v: Date | null) => void
}

const WIB_TIME_ZONE = 'Asia/Jakarta'

function getWibParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

function fromWib(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`)
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const valueParts = value ? getWibParts(value) : null
  const dateStr = valueParts?.date ?? ''
  const timeStr = valueParts?.time ?? ''

  const handleDateChange = (d: string) => {
    if (!d) {
      onChange(null)
      return
    }

    const currentTime = valueParts?.time ?? getWibParts(new Date()).time
    onChange(fromWib(d, currentTime))
  }

  const handleTimeChange = (t: string) => {
    if (!t || !value) return
    onChange(fromWib(valueParts?.date ?? getWibParts(value).date, t))
  }

  const todayStr = getWibParts(new Date()).date

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarDays size={14} className="text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">Date</span>
          </div>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            min={todayStr}
            className="input-field"
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={14} className="text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">Time (WIB)</span>
          </div>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={!value}
            className="input-field"
          />
        </div>
      </div>
      
      {value && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12.5px] font-medium text-text-primary">
            Scheduled: <span className="text-text-secondary ml-1">
              {value.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                dateStyle: 'medium',
                timeStyle: 'short'
              })} WIB
            </span>
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-semibold text-text-tertiary hover:text-danger transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        </div>
      )}

      {!value && (
        <p className="mt-2.5 text-[12px] text-text-tertiary">Leave empty to save as draft without scheduling.</p>
      )}
    </div>
  )
}
