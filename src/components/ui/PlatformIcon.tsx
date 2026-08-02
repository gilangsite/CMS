'use client'

import { Platform } from '@prisma/client'

interface PlatformIconProps {
  platform: Platform | string
  size?: number
  showLabel?: boolean
}

export function PlatformIcon({ platform, size = 20, showLabel = false }: PlatformIconProps) {
  const isInstagram = platform === 'INSTAGRAM' || platform === 'instagram'

  const icon = isInstagram ? (
    // Instagram gradient icon
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" />
    </svg>
  ) : (
    // TikTok icon
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="0" y="0" width="24" height="24" rx="4" fill="#010101" />
      <path
        d="M17 8.3a4.1 4.1 0 01-2.4-.8V14a3.6 3.6 0 11-3.6-3.6h.4v1.8h-.4a1.8 1.8 0 100 3.6 1.8 1.8 0 001.8-1.8V4h1.8a4.1 4.1 0 004 3.8V10c-.5 0-1-.1-1.6-.3V8.3z"
        fill="white"
      />
    </svg>
  )

  if (!showLabel) return <>{icon}</>

  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span className="text-sm font-medium text-text-primary">
        {isInstagram ? 'Instagram' : 'TikTok'}
      </span>
    </span>
  )
}
