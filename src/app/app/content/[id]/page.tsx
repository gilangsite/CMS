"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  PenLine,
  Send,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Calendar,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { useToast } from "@/components/ui/use-toast";
import type { ApprovalStatus, Platform, PublishingStatus } from "@prisma/client";

interface ContentDetail {
  id: string;
  title: string | null;
  internalNotes: string | null;
  approvalStatus: ApprovalStatus;
  publishingStatus: PublishingStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  creator: { id: string; name: string | null } | null;
  contentAssets: {
    id: string;
    mediaAsset: {
      id: string;
      fileUrl: string;
      thumbnailUrl: string | null;
      fileName: string | null;
      mimeType: string | null;
    };
  }[];
  platformPosts: {
    id: string;
    platform: Platform;
    destination: string;
    caption: string | null;
    hashtags: string[];
    mentions: string[];
    postMode: string;
    status: PublishingStatus;
    platformPostUrl: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    publishedAt: string | null;
    socialAccount: {
      username: string | null;
      displayName: string | null;
    };
  }[];
}

export default function ContentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const [item, setItem] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [comment, setComment] = useState("");

  const loadItem = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/content/${id}`, { cache: "no-store" });
      const json = await response.json();
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!json.success) throw new Error(json.error ?? "Unable to load content");
      setItem(json.data);
    } catch (error) {
      toast({
        title: "Content could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    // Data fetching intentionally synchronizes this client view with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItem();
  }, [loadItem]);

  const runAction = async (
    action: "approve" | "reject" | "submit-review" | "publish"
  ) => {
    setActing(true);
    try {
      const response = await fetch(`/api/content/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: comment }) : undefined,
      });
      const json = await response.json();
      if (!json.success) {
        const details = json.errors?.length ? ` ${json.errors.join(" ")}` : "";
        throw new Error(`${json.error ?? "Action failed"}${details}`);
      }
      toast({
        title:
          action === "approve"
            ? "Content approved"
            : action === "reject"
              ? "Content rejected"
              : action === "submit-review"
                ? "Submitted for review"
                : "Publish request completed",
      });
      setComment("");
      await loadItem();
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  const runPlatformAction = async (
    platformPostId: string,
    action: "mark_posted" | "retry_auto"
  ) => {
    setActing(true);
    try {
      const response = await fetch(`/api/content/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformPostId, action }),
      });
      const json = await response.json();
      if (!json.success) {
        const details = json.errors?.length ? ` ${json.errors.join(" ")}` : "";
        throw new Error(`${json.error ?? "Action failed"}${details}`);
      }
      toast({
        title: action === "mark_posted" ? "Marked as posted" : "Retry queued",
      });
      await loadItem();
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-text-tertiary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading content…
      </div>
    );
  }
  if (notFound || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <h2 className="text-xl font-bold text-text-primary">Post Not Found</h2>
        <p className="text-text-secondary">This content item does not exist or is unavailable.</p>
        <Link href="/app/content" className="btn-primary">
          Back to Content
        </Link>
      </div>
    );
  }

  const primaryPost = item.platformPosts[0];
  const canRetry =
    item.publishingStatus === "FAILED" ||
    item.publishingStatus === "APPROVED" ||
    item.publishingStatus === "SCHEDULED" ||
    item.publishingStatus === "QUEUED" ||
    item.publishingStatus === "DRAFT";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/app/content" className="action-btn h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Link href="/app/content" className="text-sm text-text-secondary hover:text-text-primary">
          Content
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary truncate">{item.title || "Untitled"}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{item.title || "Untitled"}</h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <StatusBadge status={item.approvalStatus} />
            <StatusBadge status={item.publishingStatus} />
            {item.brand && <span className="text-xs text-text-secondary">{item.brand.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => void loadItem()} className="action-btn h-9 w-9" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href={`/app/content/${id}/edit`} className="btn-secondary h-9">
            <PenLine className="w-4 h-4" /> Edit
          </Link>
          {item.approvalStatus === "DRAFT" && (
            <button
              onClick={() => void runAction("submit-review")}
              disabled={acting}
              className="btn-secondary h-9"
            >
              <Send className="w-4 h-4" /> Submit Review
            </button>
          )}
          {canRetry && (
            <button
              onClick={() => void runAction("publish")}
              disabled={acting}
              className="btn-primary h-9"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Publish Now
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="surface-base p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Caption</h2>
            <div className="bg-black/20 border border-border-default rounded-md p-4">
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {primaryPost?.caption || "No caption written yet."}
              </p>
              {(primaryPost?.mentions.length || primaryPost?.hashtags.length) && (
                <p className="text-sm text-accent-primary mt-3">
                  {[...(primaryPost?.mentions ?? []), ...(primaryPost?.hashtags ?? [])]
                    .map((tag) =>
                      tag.startsWith("#") || tag.startsWith("@")
                        ? tag
                        : `${primaryPost?.mentions.includes(tag) ? "@" : "#"}${tag}`
                    )
                    .join(" ")}
                </p>
              )}
            </div>
            {item.internalNotes && (
              <div className="mt-4 p-3 rounded-md bg-warning/5 border border-warning/20">
                <p className="text-xs font-semibold text-warning mb-1">Internal Notes</p>
                <p className="text-xs text-text-secondary whitespace-pre-wrap">{item.internalNotes}</p>
              </div>
            )}
          </section>

          <section className="surface-base p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Media</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {item.contentAssets.map(({ id: assetLinkId, mediaAsset }) => (
                <div
                  key={assetLinkId}
                  className="aspect-square rounded-xl bg-surface-strong border border-border-default overflow-hidden"
                >
                  {mediaAsset.mimeType?.startsWith("video/") ? (
                    <video src={mediaAsset.fileUrl} className="w-full h-full object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaAsset.thumbnailUrl ?? mediaAsset.fileUrl}
                      alt={mediaAsset.fileName ?? ""}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
              {item.contentAssets.length === 0 && (
                <div className="col-span-3 text-center text-sm text-text-tertiary py-8 border-2 border-dashed border-border-strong rounded-xl">
                  No media attached.
                </div>
              )}
            </div>
          </section>

          {item.platformPosts.length > 0 && (
            <section className="surface-base p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Platforms</h2>
              <div className="space-y-4">
                {item.platformPosts.map((post) => (
                  <div key={post.id} className="rounded-lg border border-border-default p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <PlatformIcon platform={post.platform} size={18} />
                        <div>
                          <p className="text-sm font-medium text-text-primary capitalize">
                            {post.destination.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            @{post.socialAccount.username ?? post.socialAccount.displayName ?? "unknown"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={post.status} />
                    </div>

                    {post.errorMessage && (
                      <div className="mt-3 flex items-start gap-2 rounded-md bg-danger/5 border border-danger/20 p-3">
                        <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-text-secondary">{post.errorMessage}</p>
                          {post.errorCode && (
                            <code className="text-[11px] text-text-tertiary mt-1 block">
                              {post.errorCode}
                            </code>
                          )}
                        </div>
                      </div>
                    )}

                    {post.status === "NEEDS_MANUAL_FINALIZATION" && (
                      <div className="mt-3">
                        {post.platform === "INSTAGRAM" && (
                          <p className="text-xs text-text-tertiary mb-2">
                            Instagram has no draft API — post this manually in the Instagram app,
                            then mark it posted here.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void runPlatformAction(post.id, "mark_posted")}
                            disabled={acting}
                            className="btn-secondary h-8 text-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Mark as Posted
                          </button>
                          <button
                            onClick={() => void runPlatformAction(post.id, "retry_auto")}
                            disabled={acting}
                            className="btn-primary h-8 text-xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry as Auto Post
                          </button>
                        </div>
                      </div>
                    )}

                    {post.status === "FAILED" && (
                      <div className="mt-3">
                        <button
                          onClick={() => void runPlatformAction(post.id, "retry_auto")}
                          disabled={acting}
                          className="btn-secondary h-8 text-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry as Auto Post
                        </button>
                      </div>
                    )}

                    {post.platformPostUrl && (
                      <a
                        href={post.platformPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-accent-primary mt-3 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View published post
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {item.approvalStatus === "IN_REVIEW" && (
            <section className="surface-base p-6 border border-warning/30">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" /> Awaiting Review
              </h2>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="textarea-field min-h-20 mb-4"
                placeholder="Optional feedback or rejection reason…"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => void runAction("approve")}
                  disabled={acting}
                  className="btn-primary h-9"
                >
                  <ThumbsUp className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => void runAction("reject")}
                  disabled={acting}
                  className="btn-secondary h-9 text-danger"
                >
                  <ThumbsDown className="w-4 h-4" /> Reject
                </button>
              </div>
            </section>
          )}

          {item.approvalStatus === "APPROVED" && (
            <section className="surface-base p-5 border border-success/30">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Content Approved</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    This content is cleared for publishing.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="surface-base p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Publishing Info</h2>
            <div className="space-y-4 text-xs">
              <InfoRow icon={Calendar} label="Scheduled">
                {item.scheduledAt
                  ? format(new Date(item.scheduledAt), "MMM d, yyyy · h:mm a")
                  : "Not scheduled"}
              </InfoRow>
              <InfoRow icon={Smartphone} label="Destination">
                {primaryPost?.destination.replace(/_/g, " ") ?? "Not selected"}
              </InfoRow>
              <InfoRow icon={Clock} label="Created">
                {format(new Date(item.createdAt), "MMM d, yyyy")}
              </InfoRow>
              <InfoRow icon={null} label="Author">
                {item.creator?.name ?? "Unknown"}
              </InfoRow>
              <InfoRow icon={null} label="Account">
                {primaryPost
                  ? `@${primaryPost.socialAccount.username ?? primaryPost.socialAccount.displayName ?? "unknown"}`
                  : "Not selected"}
              </InfoRow>
            </div>
          </section>

          {primaryPost?.platformPostUrl && (
            <a
              href={primaryPost.platformPostUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" /> View published post
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }> | null;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <Icon className="w-4 h-4 text-text-tertiary shrink-0 mt-0.5" />
      ) : (
        <div className="w-4 h-4 shrink-0" />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-medium text-text-secondary">{label}</span>
        <div className="text-text-primary capitalize">{children}</div>
      </div>
    </div>
  );
}
