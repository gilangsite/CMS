'use client'

import { Alert } from '@/components/ui/Alert'

const MODES = [
  {
    value: 'AUTO_POST',
    label: 'Auto Post',
    desc: 'CMS will publish this post automatically using the official platform API.',
    badge: 'Fully automated',
    badgeColor: 'bg-success/15 text-success',
  },
  {
    value: 'SEMI_AUTO',
    label: 'Semi-Auto',
    desc: 'CMS will prepare the post and help you finalize it inside TikTok/Instagram. Use this for native music, effects, stickers, or final manual review.',
    badge: 'Assisted',
    badgeColor: 'bg-information/15 text-information',
  },
  {
    value: 'MANUAL_REMINDER',
    label: 'Manual Reminder',
    desc: 'CMS will remind you to post manually. No media will be uploaded automatically.',
    badge: 'Manual only',
    badgeColor: 'bg-surface-strong text-text-tertiary',
  },
]

interface PostModeSelectorProps {
  value: string
  onChange: (v: string) => void
  musicPlan: string
  autoPostAvailable?: boolean
  autoPostUnavailableReason?: string
}

export function PostModeSelector({
  value,
  onChange,
  musicPlan,
  autoPostAvailable = true,
  autoPostUnavailableReason,
}: PostModeSelectorProps) {
  const needsSemiAuto = musicPlan === 'tiktok_native' || musicPlan === 'instagram_native'

  return (
    <div>
      {needsSemiAuto && (
        <div className="mb-4">
          <Alert variant="warning">
            Native TikTok/Instagram music cannot always be attached automatically through third-party APIs. Choose Semi-Auto mode if this content needs trending sound or native music.
          </Alert>
        </div>
      )}

      <div className="space-y-3">
        {MODES.map(({ value: v, label, desc, badge, badgeColor }) => {
          const selected = value === v
          const disabled = v === 'AUTO_POST' && !autoPostAvailable
          return (
            <button
              key={v}
              type="button"
              onClick={() => !disabled && onChange(v)}
              disabled={disabled}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-100 ${
                selected ? 'border-accent-primary bg-[rgba(145,168,255,0.1)] shadow-sm' : 'border-border-default bg-[rgba(0,0,0,0.2)] hover:border-border-strong hover:bg-surface-hover'
              } ${disabled ? 'opacity-45 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[13.5px] font-semibold ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${selected ? 'bg-accent-primary/20 text-accent-primary' : badgeColor}`}>{badge}</span>
              </div>
              <p className={`text-[12px] leading-relaxed ${selected ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                {disabled ? autoPostUnavailableReason ?? 'Auto Post is not available for this destination.' : desc}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
