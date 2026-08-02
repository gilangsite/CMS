export type Role = "owner" | "admin" | "manager" | "creator" | "client" | "viewer";

export type ApprovalStatus = "draft" | "in_review" | "revision_requested" | "approved" | "rejected";

export type PublishingStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "queued"
  | "posting"
  | "processing"
  | "posted"
  | "failed"
  | "cancelled"
  | "needs_manual_finalization";

export type Platform = "instagram" | "tiktok";

export type Destination =
  | "instagram_feed"
  | "instagram_reels"
  | "instagram_story"
  | "instagram_carousel"
  | "tiktok_video"
  | "tiktok_photo";

export type PostMode = "auto_post" | "semi_auto" | "manual_reminder";

export type SocialAccountStatus = "connected" | "expiring" | "expired" | "disconnected" | "error";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  timezone: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  user: User;
}

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
  color?: string;
  description?: string;
}

export interface SocialAccount {
  id: string;
  brandId: string;
  platform: Platform;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: SocialAccountStatus;
  connectedDate: string;
  lastSynced: string;
  tokenExpiryWarning?: boolean;
}

export interface Campaign {
  id: string;
  brandId: string;
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: "active" | "planned" | "completed";
  color?: string;
}

export interface MediaAsset {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number; // bytes
  width: number;
  height: number;
  duration?: number; // seconds for video
  uploadDate: string;
  uploadedBy: string;
}

export interface ContentItem {
  id: string;
  brandId: string;
  campaignId?: string;
  assigneeId?: string;
  title: string; // internal title
  caption: string;
  internalNotes?: string;
  approvalNotes?: string;
  
  destinations: Destination[];
  socialAccountIds: string[];
  mediaIds: string[];
  
  musicPlan: "embedded" | "tiktok_native" | "instagram_native" | "suggested" | "none";
  postMode: PostMode;
  
  approvalStatus: ApprovalStatus;
  publishingStatus: PublishingStatus;
  
  scheduledDate?: string; // ISO format
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ApprovalComment {
  id: string;
  contentId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  contentId?: string;
  accountId?: string;
  userId: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}
