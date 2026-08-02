'use client'

import Link from 'next/link'
import { AccountStatus, Platform } from '@prisma/client'
import { DestinationSelector } from './DestinationSelector'
import { PostModeSelector } from './PostModeSelector'
import { CollaboratorsInput } from './CollaboratorsInput'
import { AspectRatioSelector, type PreviewAspectRatio } from './AspectRatioSelector'
import { Alert } from '@/components/ui/Alert'
import { PostDestination } from './ContentComposer'

export interface PlatformFormState {
  destination: PostDestination
  socialAccountId: string
  postMode: string
  privacyLevel: string
  allowComments: boolean
  allowDuet: boolean
  allowStitch: boolean
  musicUsageConfirmed: boolean
  userConsentConfirmed: boolean
  collaborators: string[]
  aspectRatio: PreviewAspectRatio
}

interface SocialAccountLite {
  id: string
  platform: Platform
  platformAccountId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  status: AccountStatus
}

interface PlatformPostSectionProps {
  platform: 'INSTAGRAM' | 'TIKTOK'
  state: PlatformFormState
  onChange: (patch: Partial<PlatformFormState>) => void
  accounts: SocialAccountLite[]
  musicPlan: string
  tiktokDirectPostEnabled: boolean
}

export function PlatformPostSection({
  platform,
  state,
  onChange,
  accounts,
  musicPlan,
  tiktokDirectPostEnabled,
}: PlatformPostSectionProps) {
  const handleDestinationChange = (nextDestination: PostDestination) => {
    const patch: Partial<PlatformFormState> = { destination: nextDestination }
    if (
      platform === 'TIKTOK' &&
      nextDestination.startsWith('tiktok') &&
      state.postMode === 'AUTO_POST' &&
      !tiktokDirectPostEnabled
    ) {
      patch.postMode = 'SEMI_AUTO'
    }
    onChange(patch)
  }

  const label = platform === 'INSTAGRAM' ? 'Instagram' : 'TikTok'
  const isFeedOrCarousel =
    state.destination === 'instagram_feed' || state.destination === 'instagram_carousel'
  const supportsCollaborators = platform === 'INSTAGRAM' && state.destination !== 'instagram_story'

  return (
    <section className="surface-base p-6 space-y-6">
      <h3 className="text-sm font-semibold text-text-primary">{label} Settings</h3>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-3">Post Destination</label>
        <DestinationSelector platform={platform} value={state.destination} onChange={handleDestinationChange} />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Social Account</label>
        {accounts.length === 0 ? (
          <Alert variant="warning">
            No {label} accounts connected.{' '}
            <Link href="/app/social-accounts" className="underline font-medium ml-1">Connect one in Settings &rarr;</Link>
          </Alert>
        ) : (
          <select
            value={state.socialAccountId}
            onChange={(e) => onChange({ socialAccountId: e.target.value })}
            className="select-field"
          >
            <option value="">Select account to publish to…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>@{a.username ?? a.displayName ?? a.platformAccountId}</option>
            ))}
          </select>
        )}
      </div>

      {supportsCollaborators && (
        <CollaboratorsInput
          value={state.collaborators}
          onChange={(collaborators) => onChange({ collaborators })}
        />
      )}

      {platform === 'INSTAGRAM' && isFeedOrCarousel && (
        <AspectRatioSelector
          value={state.aspectRatio}
          onChange={(aspectRatio) => onChange({ aspectRatio })}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-3">Publishing Method</label>
        <PostModeSelector
          value={state.postMode}
          onChange={(postMode) => onChange({ postMode })}
          musicPlan={musicPlan}
          autoPostAvailable={platform === 'INSTAGRAM' || tiktokDirectPostEnabled}
          autoPostUnavailableReason="TikTok Direct Post is disabled until this TikTok app passes the required audit. Use Semi-Auto."
        />
        {platform === 'INSTAGRAM' && state.postMode === 'SEMI_AUTO' && (
          <div className="mt-3">
            <Alert variant="info">
              Instagram has no API for drafts or native music selection. Semi-Auto here means you&apos;ll
              need to post this manually in the Instagram app yourself — the CMS won&apos;t upload anything
              for you. Once posted, come back and mark it as posted on the content page.
            </Alert>
          </div>
        )}
      </div>

      {platform === 'TIKTOK' && state.postMode === 'AUTO_POST' && (
        <div className="space-y-5 pt-2 border-t border-border-default">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">TikTok Direct Post</h4>
            <p className="text-xs text-text-tertiary mt-1">
              TikTok requires an explicit privacy choice and confirmation immediately before upload.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Privacy</label>
            <select
              value={state.privacyLevel}
              onChange={(event) => onChange({ privacyLevel: event.target.value })}
              className="select-field"
            >
              <option value="">Select privacy…</option>
              <option value="SELF_ONLY">Only me</option>
              <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
              <option value="PUBLIC_TO_EVERYONE">Everyone</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                ['Comments', 'allowComments', state.allowComments],
                ['Duet', 'allowDuet', state.allowDuet],
                ['Stitch', 'allowStitch', state.allowStitch],
              ] as const
            ).map(([labelText, key, checked]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm text-text-secondary"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onChange({ [key]: event.target.checked })}
                />
                {labelText}
              </label>
            ))}
          </div>
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={state.musicUsageConfirmed}
              onChange={(event) => onChange({ musicUsageConfirmed: event.target.checked })}
              className="mt-0.5"
            />
            <span>I confirm this post complies with TikTok&apos;s music usage rules.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={state.userConsentConfirmed}
              onChange={(event) => onChange({ userConsentConfirmed: event.target.checked })}
              className="mt-0.5"
            />
            <span>I reviewed this post and explicitly consent to sending it to TikTok.</span>
          </label>
        </div>
      )}
    </section>
  )
}
