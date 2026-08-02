"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CheckSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import type { ApprovalStatus } from "@prisma/client";

interface ReviewItem {
  id: string;
  title: string | null;
  approvalStatus: ApprovalStatus;
  updatedAt: string;
  creator: { name: string | null } | null;
  contentAssets: {
    mediaAsset: {
      fileUrl: string;
      thumbnailUrl: string | null;
      mimeType: string | null;
    };
  }[];
  platformPosts: { caption: string | null; destination: string }[];
}

export default function ApprovalsPage() {
  const { workspace, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!workspace) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/content?workspaceId=${workspace.id}&approvalStatus=IN_REVIEW`,
        { cache: "no-store" }
      );
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load approvals");
      setItems(json.data);
    } catch (error) {
      toast({
        title: "Approval queue could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, workspace]);

  useEffect(() => {
    // Data fetching intentionally synchronizes this client view with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
  }, [loadItems]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActingId(id);
    try {
      const reason =
        action === "reject" ? window.prompt("Reason for rejection (optional):") ?? "" : "";
      const response = await fetch(`/api/content/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason }) : undefined,
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Review action failed");
      toast({ title: action === "approve" ? "Content approved" : "Content rejected" });
      await loadItems();
    } catch (error) {
      toast({
        title: "Review action failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">Review queue</p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">
            Approvals
          </h1>
        </div>
        <span className="text-sm text-text-secondary">{items.length} pending</span>
      </div>

      {busy ? (
        <div className="surface-base p-12 flex items-center justify-center min-h-[300px] text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading review queue…
        </div>
      ) : items.length === 0 ? (
        <div className="surface-base p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4 text-text-disabled">
            <CheckSquare className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">All caught up</h2>
          <p className="text-sm text-text-tertiary mt-2">
            There is no content awaiting review.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {items.map((item) => {
            const media = item.contentAssets[0]?.mediaAsset;
            return (
              <article
                key={item.id}
                className="surface-base overflow-hidden flex flex-col sm:flex-row"
              >
                <div className="w-full sm:w-60 h-40 sm:h-auto bg-surface-strong shrink-0">
                  {media?.mimeType?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.thumbnailUrl ?? media.fileUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : media?.mimeType?.startsWith("video/") ? (
                    <video src={media.fileUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-text-disabled">
                      No media
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-text-primary">
                      {item.title || "Untitled"}
                    </h3>
                    <StatusBadge status={item.approvalStatus} />
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-2 mt-2">
                    {item.platformPosts[0]?.caption || "No caption"}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-tertiary mt-4">
                    <span>{item.creator?.name ?? "Unknown creator"}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(item.updatedAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <button
                      onClick={() => void handleAction(item.id, "approve")}
                      disabled={actingId === item.id}
                      className="btn-primary h-9"
                    >
                      {actingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => void handleAction(item.id, "reject")}
                      disabled={actingId === item.id}
                      className="btn-secondary h-9 text-danger"
                    >
                      <ThumbsDown className="w-4 h-4" /> Reject
                    </button>
                    <Link
                      href={`/app/content/${item.id}`}
                      className="ml-auto text-xs font-medium text-accent-primary flex items-center gap-1"
                    >
                      View Details <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
