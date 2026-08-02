import {
  Brand,
  Campaign,
  MediaAsset,
  ContentItem,
  Notification,
} from "@/types/domain";

// Real user/workspace/team-member/social-account data now comes from
// Clerk + Prisma (see src/lib/auth/workspace.ts, src/lib/brand-context.tsx,
// src/lib/hooks/useSocialAccounts.ts, and the /api/* routes). No fake
// people or fake "connected" accounts are faked here anymore — only the
// demo content/campaign/media items below remain illustrative.

export const mockBrands: Brand[] = [
  {
    id: "brand_1",
    name: "Medtools.id",
    color: "#4F46E5",
    description: "Primary medical tools marketplace.",
  },
  {
    id: "brand_2",
    name: "Medtools Academy",
    color: "#10B981",
    description: "Educational content for medical students.",
  },
  {
    id: "brand_3",
    name: "Marcatching",
    color: "#F59E0B",
    description: "Marketing agency arm.",
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: "camp_1",
    brandId: "brand_1",
    title: "Summer Sale 2026",
    objective: "Drive conversions",
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-08-31T23:59:59Z",
    status: "active",
    color: "#F43F5E",
  },
  {
    id: "camp_2",
    brandId: "brand_2",
    title: "New Student Enrollment",
    objective: "Awareness",
    startDate: "2026-07-15T00:00:00Z",
    endDate: "2026-09-15T23:59:59Z",
    status: "active",
    color: "#3B82F6",
  },
];

export const mockMediaAssets: MediaAsset[] = [
  {
    id: "media_1",
    type: "image",
    url: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&q=80&w=800",
    thumbnailUrl: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&q=80&w=200",
    fileName: "stethoscope-sale.jpg",
    fileSize: 1024 * 1024 * 1.5,
    width: 1080,
    height: 1080,
    uploadDate: "2026-07-20T14:30:00Z",
    uploadedBy: "user_1",
  },
  {
    id: "media_2",
    type: "video",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?auto=format&fit=crop&q=80&w=200",
    fileName: "clinic-promo.mp4",
    fileSize: 1024 * 1024 * 15,
    width: 1080,
    height: 1920,
    duration: 15,
    uploadDate: "2026-07-22T09:15:00Z",
    uploadedBy: "user_2",
  },
];

export const mockContentItems: ContentItem[] = [
  {
    id: "post_1",
    brandId: "brand_1",
    campaignId: "camp_1",
    assigneeId: "user_1",
    title: "Stethoscope Flash Sale",
    caption: "Upgrade your gear! 🩺 Don't miss our summer flash sale. Up to 40% off on all Littmann stethoscopes.\n\n#medtools #medicalstudent #littmann",
    internalNotes: "Need approval from Dr. Sarah before posting.",
    destinations: ["instagram_feed"],
    socialAccountIds: ["acc_1"],
    mediaIds: ["media_1"],
    musicPlan: "none",
    postMode: "auto_post",
    approvalStatus: "approved",
    publishingStatus: "scheduled",
    scheduledDate: "2026-07-28T10:00:00Z",
    createdAt: "2026-07-25T10:00:00Z",
    updatedAt: "2026-07-26T12:00:00Z",
    createdBy: "user_1",
  },
  {
    id: "post_2",
    brandId: "brand_1",
    campaignId: "camp_1",
    assigneeId: "user_2",
    title: "Clinic Promo Video",
    caption: "Welcome to the new standard of care. ✨ #clinic #healthcare",
    destinations: ["instagram_reels", "tiktok_video"],
    socialAccountIds: ["acc_1", "acc_2"],
    mediaIds: ["media_2"],
    musicPlan: "tiktok_native",
    postMode: "semi_auto",
    approvalStatus: "in_review",
    publishingStatus: "pending_approval",
    scheduledDate: "2026-07-29T15:00:00Z",
    createdAt: "2026-07-26T14:00:00Z",
    updatedAt: "2026-07-26T14:30:00Z",
    createdBy: "user_2",
  },
  {
    id: "post_3",
    brandId: "brand_2",
    assigneeId: "user_1",
    title: "Academy Registration Opening",
    caption: "Registration opens tomorrow! Secure your spot in the next cohort. 📚",
    destinations: ["instagram_story"],
    socialAccountIds: ["acc_3"], // disconnected account
    mediaIds: [],
    musicPlan: "none",
    postMode: "manual_reminder",
    approvalStatus: "draft",
    publishingStatus: "draft",
    createdAt: "2026-07-27T09:00:00Z",
    updatedAt: "2026-07-27T09:00:00Z",
    createdBy: "user_1",
  }
];

// No real notifications backend exists yet, so this starts empty rather
// than showing fabricated activity from people who were never real.
export const mockNotifications: Notification[] = [];
