'use client'

import { Alert } from '@/components/ui/Alert'

const OPTIONS = [
  { value: 'embedded', label: 'Use embedded audio', desc: 'Audio already in the video file' },
  { value: 'tiktok_native', label: 'Add TikTok native sound manually', desc: 'Select sound inside TikTok after upload' },
  { value: 'instagram_native', label: 'Add Instagram native audio manually', desc: 'Select audio inside Instagram after upload' },
  { value: 'suggested', label: 'Suggested sound/link', desc: 'Provide a reference for the editor' },
  { value: 'none', label: 'No music', desc: 'Post without audio' },
]

interface MusicPlanSelectorProps {
  value: string
  onChange: (v: string) => void
  onPostModeChange: (v: string) => void
}

export function MusicPlanSelector({ value, onChange, onPostModeChange }: MusicPlanSelectorProps) {
  const needsSemiAuto = value === 'tiktok_native' || value === 'instagram_native'

  const handleChange = (v: string) => {
    onChange(v)
    if (v === 'tiktok_native' || v === 'instagram_native') {
      onPostModeChange('SEMI_AUTO')
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {OPTIONS.map(({ value: v, label, desc }) => {
          const checked = value === v
          return (
            <label
              key={v}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                checked ? 'border-accent-primary bg-[rgba(145,168,255,0.1)]' : 'border-border-default bg-[rgba(0,0,0,0.2)] hover:border-border-strong'
              }`}
            >
              <input
                type="radio"
                name="music_plan"
                value={v}
                checked={checked}
                onChange={() => handleChange(v)}
                className="mt-0.5 shrink-0"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <p className="text-[13.5px] font-medium text-text-primary">{label}</p>
                <p className="text-[12px] text-text-tertiary mt-0.5">{desc}</p>
              </div>
            </label>
          )
        })}
      </div>

      {value === 'suggested' && (
        <input
          type="text"
          placeholder="Paste sound name or link…"
          className="input-field mt-3"
        />
      )}

      {needsSemiAuto && (
        <div className="mt-4">
          <Alert variant="info">
            This content requires semi-auto finalization. CMS will prepare the draft, but final music selection must be completed inside TikTok/Instagram. Publishing mode has been set to Semi-Auto.
          </Alert>
        </div>
      )}
    </div>
  )
}
