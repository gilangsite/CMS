import { PostDestination } from './ContentComposer'
import { Alert } from '@/components/ui/Alert'

interface ValidatableMedia {
  mimeType: string | null
}

interface PlatformEntry {
  platform: 'INSTAGRAM' | 'TIKTOK'
  destination: PostDestination
  socialAccountId: string
  postMode: string
}

interface ValidationPanelProps {
  caption: string
  media: ValidatableMedia[]
  platforms: PlatformEntry[]
  scheduledAt: Date | null
  musicPlan: string
}

export function ValidationPanel({
  caption,
  media,
  platforms,
  scheduledAt,
  musicPlan,
}: ValidationPanelProps) {
  const errors: string[] = []
  const warnings: string[] = []

  if (platforms.length === 0) {
    warnings.push('No platform selected. Check Instagram and/or TikTok to publish this content.')
  }

  for (const { platform, destination, socialAccountId, postMode } of platforms) {
    const label = platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'
    const prefix = platforms.length > 1 ? `[${label}] ` : ''

    if (media.length === 0) {
      errors.push(`${prefix}Media is required for all posts.`)
    } else {
      const hasImage = media.some((m) => m.mimeType?.startsWith('image'))

      if (destination === 'instagram_reels' && hasImage) errors.push(`${prefix}Reels must be video only.`)
      if (destination === 'tiktok_video' && hasImage) errors.push(`${prefix}TikTok Video must be video only.`)

      if (destination === 'instagram_carousel' && media.length > 10) {
        errors.push(`${prefix}Carousel allows max 10 media items.`)
      }
      if (destination === 'tiktok_photo' && !hasImage) errors.push(`${prefix}TikTok Photo requires images.`)
      if (destination === 'tiktok_photo' && media.length > 35) {
        errors.push(`${prefix}TikTok Photo allows max 35 images.`)
      }
    }

    if (caption.length > 2200 && destination.startsWith('instagram')) {
      errors.push(`${prefix}Caption exceeds Instagram limit (2200 chars). Current: ${caption.length}`)
    }
    if (caption.length > 4000 && destination.startsWith('tiktok')) {
      errors.push(`${prefix}Caption exceeds TikTok limit (4000 chars). Current: ${caption.length}`)
    }

    if (!socialAccountId) {
      warnings.push(`${prefix}No social account selected. This platform cannot be scheduled or published.`)
    }

    if (
      postMode === 'AUTO_POST' &&
      (musicPlan === 'tiktok_native' || musicPlan === 'instagram_native')
    ) {
      errors.push(`${prefix}Native platform music requires Semi-Auto mode.`)
    }
  }

  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    errors.push('The selected schedule date is invalid.')
  }

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Alert variant="success" title="Ready to Publish">
        All requirements met. You can safely save or submit this content.
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert variant="error" title="Cannot Publish">
          <ul className="list-disc pl-4 space-y-1 mt-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert variant="warning" title="Warnings">
          <ul className="list-disc pl-4 space-y-1 mt-1">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Alert>
      )}
    </div>
  )
}
