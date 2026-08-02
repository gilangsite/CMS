'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (val: string[]) => void
  prefix: '#' | '@'
  placeholder?: string
  max?: number | null
}

const COMMIT_KEYS = ['Enter', ',', ' ']

export function TagInput({ value, onChange, prefix, placeholder, max = null }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const atLimit = max !== null && value.length >= max

  const commit = (raw: string) => {
    const tag = raw.trim().replace(new RegExp(`^\\${prefix}`), '')
    if (!tag || atLimit) return
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, tag])
    setDraft('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.includes(e.key) && draft.trim()) {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div
      className={`input-field flex flex-wrap items-center gap-1.5 min-h-[42px] py-1.5 cursor-text ${
        atLimit ? 'opacity-75' : ''
      }`}
      onClick={(e) => {
        const input = (e.currentTarget as HTMLDivElement).querySelector('input')
        input?.focus()
      }}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-surface-strong px-2 py-0.5 text-[12.5px] text-text-primary"
        >
          {prefix}{tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="text-text-tertiary hover:text-danger"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={atLimit ? undefined : (value.length === 0 ? placeholder : '')}
        disabled={atLimit}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-[13.5px] placeholder:text-text-tertiary disabled:cursor-not-allowed"
      />
    </div>
  )
}
