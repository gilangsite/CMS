import { PostDestination } from './ContentComposer'
import { Smartphone, Image as ImageIcon, Video, Layers } from 'lucide-react'
import { PlatformIcon } from '@/components/ui/PlatformIcon'

interface DestinationSelectorProps {
  value: PostDestination
  onChange: (val: PostDestination) => void
  platform?: 'INSTAGRAM' | 'TIKTOK'
}

const DESTINATIONS = [
  {
    id: 'instagram_feed',
    label: 'Instagram Post',
    platform: 'INSTAGRAM',
    desc: 'Image or video to feed',
    icon: ImageIcon,
  },
  {
    id: 'instagram_reels',
    label: 'Instagram Reel',
    platform: 'INSTAGRAM',
    desc: '9:16 short video',
    icon: Smartphone,
  },
  {
    id: 'instagram_carousel',
    label: 'Instagram Carousel',
    platform: 'INSTAGRAM',
    desc: 'Multiple images (up to 10)',
    icon: Layers,
  },
  {
    id: 'instagram_story',
    label: 'Instagram Story',
    platform: 'INSTAGRAM',
    desc: '24-hour vertical format',
    icon: Smartphone,
  },
  {
    id: 'tiktok_video',
    label: 'TikTok Video',
    platform: 'TIKTOK',
    desc: 'Standard vertical video',
    icon: Video,
  },
  {
    id: 'tiktok_photo',
    label: 'TikTok Photo',
    platform: 'TIKTOK',
    desc: 'Photo swipe carousel',
    icon: Layers,
    disabled: true,
  },
]

export function DestinationSelector({ value, onChange, platform }: DestinationSelectorProps) {
  const destinations = platform ? DESTINATIONS.filter((d) => d.platform === platform) : DESTINATIONS
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {destinations.map((dest) => {
        const isSelected = value === dest.id
        const Icon = dest.icon
        const disabled = 'disabled' in dest && dest.disabled
        
        return (
          <button
            key={dest.id}
            type="button"
            onClick={() => !disabled && onChange(dest.id as PostDestination)}
            disabled={disabled}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              isSelected
                ? 'border-accent-primary bg-[rgba(145,168,255,0.1)] text-text-primary shadow-sm'
                : 'bg-[rgba(0,0,0,0.2)] border-border-default text-text-primary hover:bg-surface-hover hover:border-border-strong'
            } ${disabled ? 'opacity-45 cursor-not-allowed hover:bg-[rgba(0,0,0,0.2)]' : ''}`}
            style={{ minHeight: '90px' }}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-accent-primary/15' : 'bg-surface-strong'}`}>
                <Icon size={16} className={isSelected ? 'text-accent-primary' : 'text-text-secondary'} />
              </div>
              <div className={isSelected ? 'text-accent-primary opacity-80' : 'text-text-tertiary'}>
                <PlatformIcon platform={dest.platform} size={14} />
              </div>
            </div>
            <div className="mt-auto">
              <p className="text-[13.5px] font-semibold leading-tight mb-0.5 text-text-primary">
                {dest.label}
              </p>
              <p className="text-[11px] leading-tight text-text-secondary">
                {disabled ? `${dest.desc} · requires a verified media domain` : dest.desc}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
