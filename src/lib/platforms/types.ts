import { Platform, PostMode, PublishingStatus } from '@prisma/client'

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface PlatformPost {
  id: string
  platform: Platform
  destination: string
  caption: string | null
  hashtags: string[]
  mentions: string[]
  collaborators: string[]
  postMode: PostMode
  privacyLevel: string | null
  allowComments: boolean | null
  allowDuet: boolean | null
  allowStitch: boolean | null
  commercialDisclosureEnabled: boolean
  commercialDisclosureType: string | null
  musicUsageConfirmed: boolean
  userConsentConfirmed: boolean
  coverTimestampMs: number | null
  // Resolved fields (populated by publishing service)
  mediaUrl?: string
  mediaUrls?: string[]
  mediaType?: string
  mediaTypes?: string[]
  fileSize?: number
  fileSizes?: number[]
  coverUrl?: string
  accessToken?: string
  platformAccountId?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PublishResult {
  success: boolean
  platformMediaId?: string
  platformPostUrl?: string
  errorCode?: string
  errorMessage?: string
  status: PublishingStatus
}

export interface DraftUploadResult {
  success: boolean
  externalId?: string
  errorCode?: string
  errorMessage?: string
}

export interface PublishStatusResult {
  status: 'processing' | 'manual_finalization' | 'posted' | 'failed'
  platformPostUrl?: string
  errorMessage?: string
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SocialPublisher {
  validate(post: PlatformPost): Promise<ValidationResult>
  publish(post: PlatformPost): Promise<PublishResult>
  uploadDraft?(post: PlatformPost): Promise<DraftUploadResult>
  // accessToken is required by platforms whose status endpoint is
  // authenticated per-account (e.g. TikTok); mock/unauthenticated
  // implementations may ignore it.
  getStatus?(externalPublishId: string, accessToken?: string): Promise<PublishStatusResult>
}
