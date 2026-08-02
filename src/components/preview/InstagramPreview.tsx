'use client'

/* eslint-disable @next/next/no-img-element -- Platform previews render user-provided remote URLs without image proxying. */

import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'

interface MediaAsset { id: string; fileUrl: string; thumbnailUrl: string | null; mimeType: string | null }

interface InstagramPreviewProps {
  destination: 'feed' | 'reels' | 'story' | 'carousel'
  media: MediaAsset[]
  caption: string
  hashtags: string[]
  username: string
  avatarUrl: string | null
  aspectRatio?: '1:1' | '4:5' | '9:16'
  collaborators?: string[]
}

const ASPECT_RATIO_CLASSES: Record<'1:1' | '4:5' | '9:16', string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
}

export function InstagramPreview({
  destination,
  media,
  caption,
  hashtags,
  username,
  avatarUrl,
  aspectRatio = '1:1',
  collaborators = [],
}: InstagramPreviewProps) {
  const [carouselIndex, setCarouselIndex] = useState(0)

  const primaryMedia = destination === 'carousel' ? media[carouselIndex] : media[0]
  const isVideo = primaryMedia?.mimeType?.startsWith('video')
  const isStory = destination === 'story'
  const isReels = destination === 'reels'
  const mediaAspectClass =
    isReels || isStory ? 'aspect-[9/16]' : ASPECT_RATIO_CLASSES[aspectRatio]

  return (
    <div className="w-[280px] bg-white border border-[#dbdbdb] rounded-xl overflow-hidden shadow-sm">
      {/* Story format */}
      {isStory ? (
        <div className="relative">
          <div className="h-[480px] bg-[#1a1a1a] relative overflow-hidden">
            {primaryMedia ? (
              isVideo ? (
                <video src={primaryMedia.fileUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={primaryMedia.thumbnailUrl ?? primaryMedia.fileUrl} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#262626] rounded-full mx-auto mb-3 flex items-center justify-center text-2xl">📷</div>
                  <p className="text-[#737373] text-xs">No media</p>
                </div>
              </div>
            )}
            {/* Story overlay UI */}
            <div className="absolute top-0 left-0 right-0 p-3">
              <div className="flex gap-0.5 mb-2">
                <div className="flex-1 h-0.5 bg-white/40 rounded-full"><div className="h-full bg-white rounded-full w-1/2" /></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-600 border-2 border-white overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <span className="text-white text-xs font-semibold">{username}</span>
                <span className="text-white/60 text-xs">Just now</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-white overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center text-[10px] font-bold text-[#737373]">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-[#0a0a0a]">{username}</p>
              {collaborators.length > 0 && (
                <p className="text-[10.5px] text-[#8e8e8e] leading-tight">
                  with {collaborators.map((c) => `@${c}`).join(', ')}
                </p>
              )}
            </div>
            <MoreHorizontal size={16} className="text-[#0a0a0a]" />
          </div>

          {/* Media */}
          <div className={`relative bg-[#f5f5f5] ${mediaAspectClass}`}>
            {primaryMedia ? (
              isVideo ? (
                <video src={primaryMedia.fileUrl} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={primaryMedia.thumbnailUrl ?? primaryMedia.fileUrl} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <div className="text-3xl opacity-30">🖼️</div>
                <p className="text-xs text-[#a3a3a3]">No media uploaded</p>
              </div>
            )}
            {destination === 'carousel' && media.length > 1 && (
              <>
                <button
                  onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                  disabled={carouselIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setCarouselIndex(Math.min(media.length - 1, carouselIndex + 1))}
                  disabled={carouselIndex === media.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {media.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === carouselIndex ? 'bg-[#3897f0]' : 'bg-white/60'}`} />
                  ))}
                </div>
              </>
            )}
            {isReels && (
              <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4 text-white">
                <div className="flex flex-col items-center gap-1"><Heart size={20} className="drop-shadow" /><span className="text-[10px]">1.2K</span></div>
                <div className="flex flex-col items-center gap-1"><MessageCircle size={20} className="drop-shadow" /><span className="text-[10px]">48</span></div>
                <div className="flex flex-col items-center gap-1"><Send size={20} className="drop-shadow" /><span className="text-[10px]">Send</span></div>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isReels && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-[#0a0a0a]" />
                  <MessageCircle size={20} className="text-[#0a0a0a]" />
                  <Send size={20} className="text-[#0a0a0a]" />
                </div>
                <Bookmark size={20} className="text-[#0a0a0a]" />
              </div>
              <p className="text-[11px] font-semibold text-[#0a0a0a] mb-1">1,248 likes</p>
              {(caption || hashtags.length > 0) && (
                <p className="text-[11px] text-[#0a0a0a] leading-relaxed line-clamp-3">
                  <span className="font-semibold">{username}</span>{' '}
                  {caption}
                  {hashtags.length > 0 && (
                    <span className="text-[#00376b]"> {hashtags.map(h => `#${h}`).join(' ')}</span>
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
