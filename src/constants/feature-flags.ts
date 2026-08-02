export const featureFlags = {
  // Instagram features
  instagramPublishing: true,       // Uses mock adapter in dev
  instagramStories: false,         // Stories API validation required
  instagramCollab: false,          // Collab invite — experimental
  instagramBrandedPartnership: false,

  // TikTok features
  tiktokUploadDraft: true,         // Semi-auto draft upload — MVP
  tiktokDirectPost: false,         // Requires TikTok app audit
  tiktokAnalytics: false,          // Phase 6

  // General
  analyticsPage: true,             // Basic skeleton enabled
  aiCaption: false,                // Phase 7+ (future)
  aiHashtag: false,
  bulkSchedule: false,

  // Publishing
  mockPublishing: process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true',
} as const

export type FeatureFlag = keyof typeof featureFlags

export function isEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] ?? false
}
