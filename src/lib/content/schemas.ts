import { Platform, PostMode } from '@prisma/client'
import { z } from 'zod'

export const postDestinationSchema = z.enum([
  'instagram_feed',
  'instagram_reels',
  'instagram_story',
  'instagram_carousel',
  'tiktok_video',
  'tiktok_photo',
])

const nullableId = z.string().trim().min(1).nullable().optional()
const nullableDateTime = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()

export const platformPostInputSchema = z.object({
  socialAccountId: nullableId,
  platform: z.nativeEnum(Platform),
  destination: postDestinationSchema,
  caption: z.string().max(4_000).nullable().optional(),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  mentions: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  collaborators: z.array(z.string().trim().min(1).max(60)).max(3).default([]),
  musicPlan: z.string().max(100).nullable().optional(),
  postMode: z.nativeEnum(PostMode).default('AUTO_POST'),
  privacyLevel: z.string().max(50).nullable().optional(),
  allowComments: z.boolean().nullable().optional(),
  allowDuet: z.boolean().nullable().optional(),
  allowStitch: z.boolean().nullable().optional(),
  commercialDisclosureEnabled: z.boolean().optional(),
  commercialDisclosureType: z.string().max(50).nullable().optional(),
  musicUsageConfirmed: z.boolean().optional(),
  userConsentConfirmed: z.boolean().optional(),
  coverTimestampMs: z.number().int().min(0).max(900_000).nullable().optional(),
  scheduledAt: nullableDateTime,
})

export const createContentInputSchema = z.object({
  workspaceId: z.string().trim().min(1),
  title: z.string().trim().max(200).nullable().optional(),
  brandId: nullableId,
  campaignId: nullableId,
  internalNotes: z.string().max(10_000).nullable().optional(),
  scheduledAt: nullableDateTime,
  mediaIds: z.array(z.string().trim().min(1)).max(35).default([]),
  platformPosts: z.array(platformPostInputSchema).max(2).default([]),
  submitForReview: z.boolean().default(false),
})

export const updateContentInputSchema = createContentInputSchema
  .omit({ workspaceId: true, submitForReview: true })
  .partial()

export type PlatformPostInput = z.infer<typeof platformPostInputSchema>
export type CreateContentInput = z.infer<typeof createContentInputSchema>
export type UpdateContentInput = z.infer<typeof updateContentInputSchema>
