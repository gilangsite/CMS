import React from "react";
import { ApprovalStatus, PublishingStatus, SocialAccountStatus } from "@/types/domain";
import type {
  AccountStatus,
  ApprovalStatus as PrismaApprovalStatus,
  PublishingStatus as PrismaPublishingStatus,
} from "@prisma/client";

type UnifiedStatus =
  | ApprovalStatus
  | PublishingStatus
  | SocialAccountStatus
  | AccountStatus
  | PrismaApprovalStatus
  | PrismaPublishingStatus
  | "active"
  | "planned"
  | "completed";

interface StatusBadgeProps {
  status: UnifiedStatus;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#858B97", bg: "rgba(133,139,151,.14)" },
  planned: { label: "Planned", color: "#858B97", bg: "rgba(133,139,151,.14)" },
  disconnected: { label: "Disconnected", color: "#858B97", bg: "rgba(133,139,151,.14)" },

  pending_approval: { label: "Pending Approval", color: "#79B8FF", bg: "rgba(121,184,255,.14)" },
  in_review: { label: "In Review", color: "#79B8FF", bg: "rgba(121,184,255,.14)" },
  processing: { label: "Processing", color: "#79B8FF", bg: "rgba(121,184,255,.14)" },
  posting: { label: "Posting", color: "#79B8FF", bg: "rgba(121,184,255,.14)" },
  queued: { label: "Queued", color: "#79B8FF", bg: "rgba(121,184,255,.14)" },

  revision_requested: { label: "Revision", color: "#5B8DF0", bg: "rgba(91,141,240,.14)" },
  approved: { label: "Approved", color: "#5B8DF0", bg: "rgba(91,141,240,.14)" },

  scheduled: { label: "Scheduled", color: "#7FA6FF", bg: "rgba(127,166,255,.14)" },

  posted: { label: "Posted", color: "#6FC6FF", bg: "rgba(111,198,255,.14)" },
  connected: { label: "Connected", color: "#6FC6FF", bg: "rgba(111,198,255,.14)" },
  active: { label: "Active", color: "#6FC6FF", bg: "rgba(111,198,255,.14)" },
  completed: { label: "Completed", color: "#6FC6FF", bg: "rgba(111,198,255,.14)" },

  needs_manual_finalization: { label: "Needs Finalize", color: "#A9C4F5", bg: "rgba(169,196,245,.14)" },
  expiring: { label: "Expiring", color: "#A9C4F5", bg: "rgba(169,196,245,.14)" },
  expired: { label: "Expired", color: "#A9C4F5", bg: "rgba(169,196,245,.14)" },

  failed: { label: "Failed", color: "#4F7EEA", bg: "rgba(79,126,234,.14)" },
  rejected: { label: "Rejected", color: "#4F7EEA", bg: "rgba(79,126,234,.14)" },
  error: { label: "Error", color: "#4F7EEA", bg: "rgba(79,126,234,.14)" },

  cancelled: { label: "Cancelled", color: "#858B97", bg: "rgba(133,139,151,.12)" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[String(status).toLowerCase()] ?? {
    label: String(status).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    color: "#93A0BE",
    bg: "rgba(126,160,235,.06)",
  };

  return (
    <span
      className={`inline-flex items-center gap-[5px] px-[9px] py-[3px] text-[11px] font-[550] rounded-[7px] ${className}`}
      style={{ color: config.color, background: config.bg }}
    >
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: config.color }} />
      {config.label}
    </span>
  );
}
