"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { endOfDay, format, isAfter, isBefore, startOfDay, startOfWeek } from "date-fns";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Loader2,
  Plus,
  Send,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import type { ApprovalStatus, PublishingStatus } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { useSocialAccounts } from "@/lib/hooks/useSocialAccounts";

interface DashboardItem {
  id: string;
  title: string | null;
  scheduledAt: string | null;
  createdAt: string;
  publishingStatus: PublishingStatus;
  approvalStatus: ApprovalStatus;
  creator: { name: string | null } | null;
  platformPosts: {
    destination: string;
    socialAccount: { platform: string; username: string | null };
  }[];
  contentAssets: {
    mediaAsset: { fileUrl: string; thumbnailUrl: string | null; mimeType: string | null };
  }[];
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { workspace, activeBrand, loading: workspaceLoading } = useBrand();
  const { user } = useUser();
  const { accounts } = useSocialAccounts();
  const { toast } = useToast();
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!workspace) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const parameters = new URLSearchParams({ workspaceId: workspace.id });
      if (activeBrand?.id) parameters.set("brandId", activeBrand.id);
      const response = await fetch(`/api/content?${parameters}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load dashboard");
      setItems(json.data);
    } catch (error) {
      toast({
        title: "Dashboard could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeBrand, toast, workspace]);

  useEffect(() => {
    // Data fetching intentionally synchronizes this client view with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
  }, [loadItems]);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const todayItems = items
    .filter((item) => {
      if (!item.scheduledAt) return false;
      const date = new Date(item.scheduledAt);
      return !isBefore(date, todayStart) && !isAfter(date, todayEnd);
    })
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const approvals = items.filter((item) => item.approvalStatus === "IN_REVIEW");
  const postedThisWeek = items.filter(
    (item) => item.publishingStatus === "POSTED" && new Date(item.createdAt) >= startOfWeek(now)
  ).length;
  const unhealthyAccounts = accounts.filter((account) =>
    ["EXPIRED", "ERROR", "DISCONNECTED"].includes(account.status)
  );
  const scheduledByPlatform = {
    instagram: todayItems.filter((item) =>
      item.platformPosts.some((post) => post.socialAccount.platform === "INSTAGRAM")
    ).length,
    tiktok: todayItems.filter((item) =>
      item.platformPosts.some((post) => post.socialAccount.platform === "TIKTOK")
    ).length,
  };
  const contextLabel = activeBrand?.name ?? workspace?.name ?? "";
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";
  const busy = workspaceLoading || loading;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">
            {format(now, "EEEE, MMMM d")}
            {contextLabel ? ` · ${contextLabel}` : ""}
          </p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]" suppressHydrationWarning>
            {greetingForHour(now.getHours())}, {firstName}
          </h1>
          <p className="text-text-tertiary mt-2 text-sm">
            {approvals.length} items await review and {todayItems.length} posts are on today&apos;s timeline.
          </p>
        </div>
        <Link href="/app/content/new" className="btn-primary w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New Content
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Scheduled Today"
          value={todayItems.length}
          detail={`${scheduledByPlatform.instagram} IG · ${scheduledByPlatform.tiktok} TikTok`}
          href="/app/calendar"
          icon={CalendarDays}
        />
        <MetricCard title="Awaiting Approval" value={approvals.length} detail="Needs review" href="/app/approvals" icon={CheckSquare} />
        <MetricCard title="Posted This Week" value={postedThisWeek} detail="Successfully published" href="/app/content" icon={Send} />
        <MetricCard title="Needs Action" value={unhealthyAccounts.length} detail="Social account health" href="/app/social-accounts" icon={AlertCircle} />
      </div>

      {busy ? (
        <div className="surface-base min-h-[320px] flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading workspace…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <DashboardSection title="Today’s Publishing Timeline" icon={Activity} href="/app/calendar">
              {todayItems.length ? (
                todayItems.map((item) => <DashboardRow key={item.id} item={item} kind="timeline" />)
              ) : (
                <EmptyRow>No posts scheduled for today.</EmptyRow>
              )}
            </DashboardSection>
            <DashboardSection title="Approval Inbox" icon={CheckSquare} href="/app/approvals">
              {approvals.length ? (
                approvals.slice(0, 5).map((item) => <DashboardRow key={item.id} item={item} kind="approval" />)
              ) : (
                <EmptyRow>Nothing is waiting for review.</EmptyRow>
              )}
            </DashboardSection>
          </div>
          <section className="surface-base overflow-hidden h-fit">
            <div className="p-5 border-b border-border-subtle">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" /> Account Health
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {unhealthyAccounts.length ? (
                unhealthyAccounts.map((account) => (
                  <div key={account.id} className="p-3 rounded-lg bg-surface-subtle border border-border-default">
                    <p className="text-sm font-medium text-text-primary">
                      {account.displayName || account.username || account.platformAccountId}
                    </p>
                    <p className="text-xs text-warning mt-1">{account.status.replaceAll("_", " ")}</p>
                    <Link href="/app/social-accounts" className="text-xs text-accent-primary inline-block mt-2">
                      Reconnect account
                    </Link>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-xs text-text-tertiary">
                  {accounts.length ? "All connected accounts are healthy." : "No social accounts connected yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  href,
  icon: Icon,
}: {
  title: string;
  value: number;
  detail: string;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <Link href={href} className="surface-base p-5 hover-lift block">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="text-3xl font-semibold text-text-primary mt-2 tabular-nums">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-accent-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-text-tertiary mt-4">{detail}</p>
    </Link>
  );
}

function DashboardSection({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  icon: React.ElementType;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-base overflow-hidden">
      <div className="p-5 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent-primary" /> {title}
        </h2>
        <Link href={href} className="text-xs text-text-secondary flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

function DashboardRow({ item, kind }: { item: DashboardItem; kind: "timeline" | "approval" }) {
  const media = item.contentAssets[0]?.mediaAsset;
  return (
    <Link href={`/app/content/${item.id}`} className="flex items-center gap-4 p-5 hover:bg-surface-hover">
      <div className="w-12 h-12 rounded-md bg-surface-strong overflow-hidden shrink-0">
        {media?.mimeType?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailUrl ?? media.fileUrl} alt="" className="w-full h-full object-cover" />
        ) : media?.mimeType?.startsWith("video/") ? (
          <video src={media.fileUrl} muted className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {kind === "timeline" && item.scheduledAt && (
            <span className="text-xs text-text-secondary">{format(new Date(item.scheduledAt), "h:mm a")}</span>
          )}
          <StatusBadge status={kind === "timeline" ? item.publishingStatus : item.approvalStatus} />
        </div>
        <p className="text-sm font-medium text-text-primary truncate">{item.title || "Untitled"}</p>
        <p className="text-xs text-text-tertiary truncate mt-1">
          {kind === "approval"
            ? `Creator: ${item.creator?.name || "Unknown"}`
            : item.platformPosts.map((post) => post.destination.replaceAll("_", " ")).join(", ")}
        </p>
      </div>
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-text-tertiary">{children}</div>;
}
