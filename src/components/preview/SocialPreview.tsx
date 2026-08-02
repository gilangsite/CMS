'use client'

import { useState } from 'react'
import { InstagramPreview } from './InstagramPreview'
import { TikTokPreview } from './TikTokPreview'
import type { PreviewAspectRatio } from '@/components/content/AspectRatioSelector'

interface MediaAsset {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  mimeType: string | null
}

interface SocialPreviewProps {
  platform: 'instagram' | 'tiktok'
  destination: 'feed' | 'reels' | 'story' | 'carousel' | 'video' | 'photo'
  media: MediaAsset[]
  caption: string
  hashtags?: string[]
  username: string
  avatarUrl: string | null
  musicPlan?: string
  aspectRatio?: PreviewAspectRatio
  collaborators?: string[]
  availablePlatforms?: ('instagram' | 'tiktok')[]
}

export function SocialPreview({
  platform,
  destination,
  media,
  caption,
  hashtags = [],
  username,
  avatarUrl,
  musicPlan,
  aspectRatio,
  collaborators = [],
  availablePlatforms = ['instagram', 'tiktok'],
}: SocialPreviewProps) {
  const [manualTab, setManualTab] = useState<'instagram' | 'tiktok' | null>(null)
  const activePlatform =
    manualTab && availablePlatforms.includes(manualTab)
      ? manualTab
      : availablePlatforms.includes(platform)
        ? platform
        : availablePlatforms[0]

  return (
    <div>
      {/* Tab switcher */}
      {availablePlatforms.length > 1 && (
        <div className="flex items-center gap-1 p-1 bg-surface-strong rounded-lg mb-5">
          <button
            onClick={() => setManualTab('instagram')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activePlatform === 'instagram'
                ? 'bg-surface-hover shadow-sm text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Instagram
          </button>
          <button
            onClick={() => setManualTab('tiktok')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activePlatform === 'tiktok'
                ? 'bg-surface-hover shadow-sm text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            TikTok
          </button>
        </div>
      )}

      {/* Preview frame */}
      <div className="flex flex-col items-center">
        {activePlatform === 'instagram' ? (
          <InstagramPreview
            destination={destination === 'video' || destination === 'photo' ? 'feed' : destination}
            media={media}
            caption={caption}
            hashtags={hashtags}
            username={username}
            avatarUrl={avatarUrl}
            aspectRatio={aspectRatio}
            collaborators={collaborators}
          />
        ) : (
          <TikTokPreview
            destination={destination === 'carousel' ? 'photo' : (destination === 'reels' || destination === 'story' ? 'video' : destination as 'video' | 'photo')}
            media={media}
            caption={caption}
            hashtags={hashtags}
            username={username}
            avatarUrl={avatarUrl}
            musicPlan={musicPlan}
          />
        )}

        {/* Disclaimer */}
        <p className="mt-4 text-[10px] text-text-tertiary text-center max-w-[260px]">
          Preview is approximate. Final appearance may vary slightly on {activePlatform === 'instagram' ? 'Instagram' : 'TikTok'}.
        </p>
      </div>
    </div>
  )
}
