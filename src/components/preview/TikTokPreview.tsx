'use client'

/* eslint-disable @next/next/no-img-element -- Platform previews render user-provided remote URLs without image proxying. */

import { Heart, MessageCircle, Bookmark, Share2, Music2 } from 'lucide-react'

interface MediaAsset { id: string; fileUrl: string; thumbnailUrl: string | null; mimeType: string | null }

interface TikTokPreviewProps {
  destination: 'video' | 'photo'
  media: MediaAsset[]
  caption: string
  hashtags: string[]
  username: string
  avatarUrl: string | null
  musicPlan?: string
}

export function TikTokPreview({ media, caption, hashtags, username, avatarUrl, musicPlan }: TikTokPreviewProps) {
  const primaryMedia = media[0]
  const isVideo = primaryMedia?.mimeType?.startsWith('video')

  const musicLabel =
    musicPlan === 'embedded' ? 'Embedded audio'
    : musicPlan === 'tiktok_native' ? '♪ Add native TikTok sound in app'
    : musicPlan === 'none' ? 'No music'
    : musicPlan === 'suggested' ? '♪ Suggested sound'
    : '♪ Original sound'

  return (
    <div className="w-[280px] bg-[#010101] rounded-xl overflow-hidden shadow-sm relative" style={{ height: '480px' }}>
      {/* Background media */}
      <div className="absolute inset-0">
        {primaryMedia ? (
          isVideo ? (
            <video src={primaryMedia.fileUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={primaryMedia.thumbnailUrl ?? primaryMedia.fileUrl} alt="" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl opacity-20 mb-2">▶</div>
              <p className="text-[#737373] text-xs">No media uploaded</p>
            </div>
          </div>
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-center pt-3 pb-2">
        <div className="flex items-center gap-6 text-white text-xs font-medium">
          <span className="text-white/60">Following</span>
          <span className="border-b-2 border-white pb-0.5">For You</span>
        </div>
      </div>

      {/* Right sidebar actions */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-5 z-10">
        <div className="w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-[#262626]">
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Heart size={24} className="text-white fill-white" />
          <span className="text-white text-[10px]">12.4K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle size={22} className="text-white" />
          <span className="text-white text-[10px]">348</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Bookmark size={22} className="text-white" />
          <span className="text-white text-[10px]">1.2K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 size={22} className="text-white" />
          <span className="text-white text-[10px]">Share</span>
        </div>
        {/* Spinning record */}
        <div className="w-9 h-9 rounded-full bg-[#262626] border-4 border-[#1a1a1a] flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
          <Music2 size={14} className="text-white" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-12 p-3 z-10">
        <p className="text-white text-xs font-bold mb-1">@{username}</p>
        {caption && (
          <p className="text-white text-[11px] leading-relaxed line-clamp-2 mb-1.5">
            {caption}
            {hashtags.length > 0 && (
              <span className="opacity-80"> {hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}</span>
            )}
          </p>
        )}
        <div className="flex items-center gap-1.5">
          <Music2 size={11} className="text-white" />
          <p className="text-white text-[10px] opacity-80 truncate">{musicLabel}</p>
        </div>
      </div>
    </div>
  )
}
