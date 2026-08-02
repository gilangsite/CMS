'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Brand, Campaign, Platform, AccountStatus } from '@prisma/client'
import {
  Save,
  Send,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Info,
  CalendarClock,
  Rocket,
} from 'lucide-react'
import { CaptionEditor } from './CaptionEditor'
import { PlatformPostSection, type PlatformFormState } from './PlatformPostSection'
import { MusicPlanSelector } from './MusicPlanSelector'
import { SchedulePicker } from './SchedulePicker'
import { ValidationPanel } from './ValidationPanel'
import { SocialPreview } from '@/components/preview/SocialPreview'
import { MediaUploader } from '@/components/media/MediaUploader'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { Alert } from '@/components/ui/Alert'
import Link from 'next/link'

interface MediaAsset {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  fileName: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
}

type PlatformKey = 'INSTAGRAM' | 'TIKTOK'
const PLATFORM_ORDER: PlatformKey[] = ['INSTAGRAM', 'TIKTOK']

interface ComposerProps {
  workspaceId: string
  contentItemId?: string
  tiktokDirectPostEnabled?: boolean
  publicMediaStorageConfigured?: boolean
  initialData?: {
    title: string | null
    internalNotes: string | null
    approvalStatus: string
    brandId: string | null
    campaignId: string | null
    scheduledAt: Date | null
    contentAssets: { mediaAsset: MediaAsset; sortOrder: number }[]
    platformPosts: {
      id: string
      platform: Platform
      destination: string
      caption: string | null
      hashtags: string[]
      mentions: string[]
      collaborators: string[]
      musicPlan: string | null
      postMode: string
      privacyLevel: string | null
      allowComments: boolean | null
      allowDuet: boolean | null
      allowStitch: boolean | null
      commercialDisclosureEnabled: boolean
      commercialDisclosureType: string | null
      musicUsageConfirmed: boolean
      userConsentConfirmed: boolean
      coverTimestampMs: number | null
      scheduledAt: Date | null
      socialAccountId: string | null
    }[]
  }
  brands: Brand[]
  campaigns: Campaign[]
  socialAccounts: {
    id: string
    platform: Platform
    platformAccountId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
    status: AccountStatus
  }[]
}

export type PostDestination =
  | 'instagram_feed'
  | 'instagram_reels'
  | 'instagram_story'
  | 'instagram_carousel'
  | 'tiktok_video'
  | 'tiktok_photo'

function buildDefaultPlatformState(
  platform: PlatformKey,
  tiktokDirectPostEnabled: boolean
): PlatformFormState {
  return {
    destination: platform === 'INSTAGRAM' ? 'instagram_feed' : 'tiktok_video',
    socialAccountId: '',
    postMode: platform === 'TIKTOK' && !tiktokDirectPostEnabled ? 'SEMI_AUTO' : 'AUTO_POST',
    privacyLevel: '',
    allowComments: false,
    allowDuet: false,
    allowStitch: false,
    musicUsageConfirmed: false,
    userConsentConfirmed: false,
    collaborators: [],
    aspectRatio: '1:1',
  }
}

export function ContentComposer({
  workspaceId,
  contentItemId,
  tiktokDirectPostEnabled = false,
  publicMediaStorageConfigured = false,
  initialData,
  brands,
  campaigns,
  socialAccounts,
}: ComposerProps) {
  const router = useRouter()
  const [persistedContentItemId, setPersistedContentItemId] = useState(contentItemId)
  const isEditing = !!persistedContentItemId

  const buildInitialPlatformState = useCallback(
    (platform: PlatformKey): PlatformFormState => {
      const existing = initialData?.platformPosts?.find((p) => p.platform === platform)
      if (!existing) return buildDefaultPlatformState(platform, tiktokDirectPostEnabled)
      return {
        destination: existing.destination as PostDestination,
        socialAccountId: existing.socialAccountId ?? '',
        postMode: existing.postMode,
        privacyLevel: existing.privacyLevel ?? '',
        allowComments: existing.allowComments ?? false,
        allowDuet: existing.allowDuet ?? false,
        allowStitch: existing.allowStitch ?? false,
        musicUsageConfirmed: existing.musicUsageConfirmed ?? false,
        userConsentConfirmed: existing.userConsentConfirmed ?? false,
        collaborators: existing.collaborators ?? [],
        aspectRatio: '1:1',
      }
    },
    [initialData, tiktokDirectPostEnabled]
  )

  // Form state
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [brandId, setBrandId] = useState(initialData?.brandId ?? '')
  const [campaignId, setCampaignId] = useState(initialData?.campaignId ?? '')
  const [caption, setCaption] = useState(initialData?.platformPosts?.[0]?.caption ?? '')
  const [hashtags, setHashtags] = useState<string[]>(initialData?.platformPosts?.[0]?.hashtags ?? [])
  const [mentions, setMentions] = useState<string[]>(initialData?.platformPosts?.[0]?.mentions ?? [])
  const [musicPlan, setMusicPlan] = useState(initialData?.platformPosts?.[0]?.musicPlan ?? 'embedded')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>(() => {
    const existingPlatforms = initialData?.platformPosts?.map((p) => p.platform as PlatformKey) ?? []
    const fromExisting = PLATFORM_ORDER.filter((p) => existingPlatforms.includes(p))
    return fromExisting.length ? fromExisting : ['INSTAGRAM']
  })
  const [platformState, setPlatformState] = useState<Record<PlatformKey, PlatformFormState>>({
    INSTAGRAM: buildInitialPlatformState('INSTAGRAM'),
    TIKTOK: buildInitialPlatformState('TIKTOK'),
  })
  const [scheduledAt, setScheduledAt] = useState<Date | null>(initialData?.scheduledAt ?? null)
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes ?? '')
  const [media, setMedia] = useState<MediaAsset[]>(
    initialData?.contentAssets?.map((ca) => ca.mediaAsset) ?? []
  )
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const orderedSelectedPlatforms = PLATFORM_ORDER.filter((p) => selectedPlatforms.includes(p))

  const togglePlatform = (platform: PlatformKey, checked: boolean) => {
    setSelectedPlatforms((prev) =>
      checked ? [...prev, platform] : prev.filter((p) => p !== platform)
    )
  }

  const updatePlatformState = (platform: PlatformKey, patch: Partial<PlatformFormState>) => {
    setPlatformState((prev) => ({ ...prev, [platform]: { ...prev[platform], ...patch } }))
  }

  const forceSemiAutoAllPlatforms = () => {
    setPlatformState((prev) => ({
      INSTAGRAM: { ...prev.INSTAGRAM, postMode: 'SEMI_AUTO' },
      TIKTOK: { ...prev.TIKTOK, postMode: 'SEMI_AUTO' },
    }))
  }

  const accountsFor = (platform: PlatformKey) =>
    socialAccounts.filter((a) => a.platform === platform)

  // Determine preview platform/destination — the first checked platform, defaulting to Instagram
  const previewPlatformKey: PlatformKey = orderedSelectedPlatforms[0] ?? 'INSTAGRAM'
  const previewState = platformState[previewPlatformKey]
  const previewPlatform = previewPlatformKey === 'INSTAGRAM' ? 'instagram' : 'tiktok'
  const previewDest = previewState.destination.replace('instagram_', '').replace('tiktok_', '') as
    | 'feed' | 'reels' | 'story' | 'carousel' | 'video' | 'photo'
  const previewAccount = socialAccounts.find((a) => a.id === previewState.socialAccountId)
  const previewAvailablePlatforms: ('instagram' | 'tiktok')[] = orderedSelectedPlatforms.length
    ? orderedSelectedPlatforms.map((p) => (p === 'INSTAGRAM' ? 'instagram' : 'tiktok'))
    : ['instagram']

  // Caption limits follow Instagram's stricter rules whenever Instagram is one of the selected platforms
  const captionLimitDestination = orderedSelectedPlatforms.includes('INSTAGRAM')
    ? platformState.INSTAGRAM.destination
    : platformState.TIKTOK.destination

  const handleSave = useCallback(
    async (action: 'draft' | 'review' | 'schedule' | 'publish') => {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      try {
        const activePosts = orderedSelectedPlatforms.map((platform) => ({
          platform,
          state: platformState[platform],
        }))

        if ((action === 'schedule' || action === 'publish') && media.length === 0) {
          throw new Error('Attach at least one media file before publishing.')
        }
        if (
          (action === 'schedule' || action === 'publish') &&
          !publicMediaStorageConfigured &&
          media.some((asset) => !asset.fileUrl.startsWith('https://'))
        ) {
          throw new Error(
            'This media is stored on localhost and cannot be reached by Instagram. Add BLOB_READ_WRITE_TOKEN to .env.local, restart npm run dev, then retry.'
          )
        }
        if ((action === 'schedule' || action === 'publish') && activePosts.length === 0) {
          throw new Error('Select at least one platform (Instagram and/or TikTok) to publish to.')
        }
        if (
          (action === 'schedule' || action === 'publish') &&
          activePosts.some(({ state }) => !state.socialAccountId)
        ) {
          throw new Error('Select the social account that should receive this post for every selected platform.')
        }
        if (action === 'schedule') {
          if (!scheduledAt) throw new Error('Choose a date and time before scheduling.')
          if (scheduledAt.getTime() <= Date.now() + 15_000) {
            throw new Error('Scheduled time must be at least 15 seconds in the future.')
          }
        }
        if (action === 'publish') {
          const invalidTikTok = activePosts.find(
            ({ platform, state }) =>
              platform === 'TIKTOK' &&
              state.postMode === 'AUTO_POST' &&
              (!state.privacyLevel || !state.musicUsageConfirmed || !state.userConsentConfirmed)
          )
          if (invalidTikTok) {
            throw new Error('TikTok Direct Post requires privacy, music usage, and final consent confirmation.')
          }
        }

        const body = {
          workspaceId,
          title,
          brandId: brandId || null,
          campaignId: campaignId || null,
          internalNotes,
          scheduledAt: scheduledAt?.toISOString() ?? null,
          mediaIds: media.map((m) => m.id),
          platformPosts: activePosts.map(({ platform, state }) => ({
            socialAccountId: state.socialAccountId || null,
            platform,
            destination: state.destination,
            caption,
            hashtags,
            mentions,
            collaborators: platform === 'INSTAGRAM' ? state.collaborators : [],
            musicPlan,
            postMode: state.postMode,
            privacyLevel: state.privacyLevel || null,
            allowComments: state.allowComments,
            allowDuet: state.allowDuet,
            allowStitch: state.allowStitch,
            musicUsageConfirmed: state.musicUsageConfirmed,
            userConsentConfirmed: state.userConsentConfirmed,
            scheduledAt: scheduledAt?.toISOString() ?? null,
          })),
          submitForReview: false,
        }

        const url = isEditing ? `/api/content/${persistedContentItemId}` : '/api/content'
        const method = isEditing ? 'PATCH' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await res.json()
        if (!data.success) throw new Error(data.error ?? 'Failed to save')
        const savedId = persistedContentItemId ?? data.data?.id
        if (!savedId) throw new Error('The content was saved without an ID.')
        if (!persistedContentItemId) {
          setPersistedContentItemId(savedId)
          window.history.replaceState(null, '', `/app/content/${savedId}/edit`)
        }

        if (action !== 'draft') {
          const actionUrl =
            action === 'review'
              ? `/api/content/${savedId}/submit-review`
              : action === 'schedule'
                ? `/api/content/${savedId}/schedule`
                : `/api/content/${savedId}/publish`
          const actionRes = await fetch(actionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: action === 'schedule'
              ? JSON.stringify({ scheduledAt: scheduledAt?.toISOString() })
              : undefined,
          })
          const actionData = await actionRes.json()
          if (!actionData.success) {
            const distinctErrors = Array.isArray(actionData.errors)
              ? [...new Set(
                  actionData.errors.filter(
                    (message: unknown) =>
                      typeof message === 'string' && message !== actionData.error
                  )
                )]
              : []
            const detail = distinctErrors.length
              ? ` ${distinctErrors.join(' ')}`
              : ''
            throw new Error(`${actionData.error ?? `Failed to ${action} content`}${detail}`)
          }
        }

        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        setSuccessMessage(
          action === 'draft'
            ? 'Draft saved.'
            : action === 'review'
              ? 'Content submitted for review.'
              : action === 'schedule'
                ? `Post scheduled for ${scheduledAt?.toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })} WIB.`
                : 'Publish request completed. The latest platform status is now saved.'
        )

        if (!isEditing) {
          router.replace(`/app/content/${savedId}/edit`)
        } else {
          router.refresh()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setSaving(false)
      }
    },
    [
      workspaceId,
      title,
      brandId,
      campaignId,
      internalNotes,
      scheduledAt,
      media,
      orderedSelectedPlatforms,
      platformState,
      caption,
      hashtags,
      mentions,
      musicPlan,
      publicMediaStorageConfigured,
      isEditing,
      persistedContentItemId,
      router,
    ]
  )

  return (
    <div className="max-w-[1360px] mx-auto w-full">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/app/content"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-border-default bg-surface-default text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
              {isEditing ? 'Edit Content' : 'New Content'}
            </h2>
            <p className="text-[13.5px] text-text-secondary mt-0.5">
              {isEditing ? `Editing — ${title || 'Untitled'}` : 'Create a new post'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn-secondary hidden xl:flex"
            type="button"
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="btn-secondary"
            type="button"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} className="text-success" /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Draft'}
          </button>

          <button
            onClick={() => handleSave('review')}
            disabled={saving}
            className="btn-secondary"
            type="button"
          >
            <Send size={16} />
            Submit for Review
          </button>

          {scheduledAt ? (
            <button
              onClick={() => handleSave('schedule')}
              disabled={saving}
              className="btn-primary"
              type="button"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              Schedule
            </button>
          ) : (
            <button
              onClick={() => handleSave('publish')}
              disabled={saving}
              className="btn-primary"
              type="button"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Publish Now
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="error" title="Action failed">{error}</Alert>
        </div>
      )}
      {successMessage && (
        <div className="mb-6">
          <Alert variant="success" title="Done">{successMessage}</Alert>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className={`grid grid-cols-1 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''} gap-8 items-start`}>

        {/* LEFT / MAIN COLUMN */}
        <div className={`flex flex-col gap-6 ${!showPreview ? 'max-w-3xl mx-auto w-full' : ''}`}>

          {/* Section: Details */}
          <section className="surface-base p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Content Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this content a clear, internal title…"
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="select-field"
                >
                  <option value="">No brand specified</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Campaign</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="select-field"
                >
                  <option value="">No campaign specified</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Media */}
          <section className="surface-base p-6">
            <label className="block text-sm font-medium text-text-secondary mb-3">Media Assets</label>
            {!publicMediaStorageConfigured && (
              <div className="mb-4">
                <Alert variant="warning" title="Public media storage is not configured">
                  Files already saved on localhost can be used for drafts and previews, but
                  Instagram cannot download them. Add <code>BLOB_READ_WRITE_TOKEN</code> to{' '}
                  <code>.env.local</code> and restart the development server before publishing.
                </Alert>
              </div>
            )}
            <MediaUploader
              workspaceId={workspaceId}
              media={media}
              onMediaChange={setMedia}
            />
          </section>

          {/* Section: Platforms */}
          <section className="surface-base p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">Publish To</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORM_ORDER.map((platform) => {
                  const checked = selectedPlatforms.includes(platform)
                  return (
                    <label
                      key={platform}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        checked
                          ? 'border-accent-primary bg-[rgba(145,168,255,0.1)]'
                          : 'border-border-default bg-[rgba(0,0,0,0.2)] hover:border-border-strong'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => togglePlatform(platform, e.target.checked)}
                      />
                      <PlatformIcon platform={platform} size={20} showLabel />
                    </label>
                  )
                })}
              </div>
              {selectedPlatforms.length === 2 && (
                <p className="text-[11px] text-text-tertiary mt-2">
                  This content will be mirrored to both platforms using the same media and caption below.
                </p>
              )}
            </div>
          </section>

          {orderedSelectedPlatforms.map((platform) => (
            <PlatformPostSection
              key={platform}
              platform={platform}
              state={platformState[platform]}
              onChange={(patch) => updatePlatformState(platform, patch)}
              accounts={accountsFor(platform)}
              musicPlan={musicPlan}
              tiktokDirectPostEnabled={tiktokDirectPostEnabled}
            />
          ))}

          {/* Section: Caption */}
          <section className="surface-base p-6">
            <label className="block text-sm font-medium text-text-secondary mb-3">Caption & Tags</label>
            <CaptionEditor
              caption={caption}
              hashtags={hashtags}
              mentions={mentions}
              destination={captionLimitDestination}
              onCaptionChange={setCaption}
              onHashtagsChange={setHashtags}
              onMentionsChange={setMentions}
            />
          </section>

          {/* Section: Audio Strategy */}
          <section className="surface-base p-6">
            <label className="block text-sm font-medium text-text-secondary mb-3">Audio Strategy</label>
            <MusicPlanSelector value={musicPlan} onChange={setMusicPlan} onPostModeChange={forceSemiAutoAllPlatforms} />
          </section>

          <section className="surface-base p-6">
            <label className="block text-sm font-medium text-text-secondary mb-3">Schedule Date & Time</label>
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
          </section>

          <section className="surface-base p-6">
            <label className="block text-sm font-medium text-text-secondary mb-2">Internal Notes</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notes, instructions, or context for your team (not published)…"
              rows={3}
              className="textarea-field"
            />
          </section>

          {/* Pre-flight Checks */}
          <section className="mb-8">
            <ValidationPanel
              caption={caption}
              media={media}
              platforms={orderedSelectedPlatforms.map((platform) => ({
                platform,
                destination: platformState[platform].destination,
                socialAccountId: platformState[platform].socialAccountId,
                postMode: platformState[platform].postMode,
              }))}
              scheduledAt={scheduledAt}
              musicPlan={musicPlan}
            />
          </section>

        </div>

        {/* RIGHT COLUMN: Preview (Sticky) */}
        {showPreview && (
          <div className="hidden xl:block sticky top-24 w-[420px] self-start shrink-0">
            <div className="surface-base p-6 shadow-elevated">
              <div className="flex items-center gap-2 mb-6">
                <Info size={16} className="text-text-tertiary" />
                <h3 className="text-[13.5px] font-semibold text-text-primary">Live Preview</h3>
              </div>
              <SocialPreview
                platform={previewPlatform}
                destination={previewDest}
                media={media}
                caption={caption}
                hashtags={hashtags}
                username={previewAccount?.username ?? 'your_account'}
                avatarUrl={previewAccount?.avatarUrl ?? null}
                musicPlan={musicPlan}
                aspectRatio={platformState.INSTAGRAM.aspectRatio}
                collaborators={platformState.INSTAGRAM.collaborators}
                availablePlatforms={previewAvailablePlatforms}
              />
              <p className="text-[11px] text-text-tertiary text-center mt-6">
                Preview is an approximation. Actual rendering may vary based on platform updates and user devices.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
