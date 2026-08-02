"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { BarChart3, ExternalLink, Heart, Loader2, MessageCircle, Send, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { cn } from "@/lib/utils";

interface AnalyticsPost {
  id: string;
  contentItemId: string;
  title: string | null;
  platform: "INSTAGRAM" | "TIKTOK";
  destination: string;
  publishedAt: string | null;
  platformPostUrl: string | null;
  capturedAt: string | null;
  media: { fileUrl: string; thumbnailUrl: string | null; mimeType: string | null } | null;
  metrics: {
    reach: number;
    interactions: number;
    likes: number;
    comments: number;
    shares: number;
    saved: number;
  };
}

interface AnalyticsData {
  days: number;
  postedCount: number;
  snapshotCount: number;
  totals: AnalyticsPost["metrics"];
  posts: AnalyticsPost[];
}

function number(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard" }).format(value);
}

export default function AnalyticsPage() {
  const { workspace, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    if (!workspace) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?workspaceId=${workspace.id}&days=${days}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load analytics");
      setData(json.data);
    } catch (error) {
      toast({
        title: "Analytics could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [days, toast, workspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalytics();
  }, [loadAnalytics]);

  const daily = useMemo(() => {
    const output = Array.from({ length: Math.min(days, 14) }, (_, index) => {
      const date = subDays(new Date(), Math.min(days, 14) - index - 1);
      const key = format(date, "yyyy-MM-dd");
      return { key, label: format(date, days <= 7 ? "EEE" : "MMM d"), count: 0 };
    });
    for (const post of data?.posts ?? []) {
      if (!post.publishedAt) continue;
      const bucket = output.find((item) => item.key === format(new Date(post.publishedAt!), "yyyy-MM-dd"));
      if (bucket) bucket.count++;
    }
    return output;
  }, [data?.posts, days]);

  const topPosts = [...(data?.posts ?? [])]
    .sort((a, b) => b.metrics.interactions - a.metrics.interactions)
    .slice(0, 5);
  const maxDaily = Math.max(1, ...daily.map((item) => item.count));
  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">Real published-post data · last {days} days</p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">Analytics</h1>
        </div>
        <div className="flex p-0.5 bg-black/20 border border-border-default rounded-md">
          {[7, 30, 90].map((range) => (
            <button
              key={range}
              onClick={() => setDays(range)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded",
                days === range ? "bg-surface-hover text-text-primary" : "text-text-secondary"
              )}
            >
              {range}D
            </button>
          ))}
        </div>
      </div>

      {busy ? (
        <div className="surface-base min-h-[420px] flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
        </div>
      ) : (
        <>
          {data && data.postedCount > 0 && data.snapshotCount === 0 && (
            <div className="surface-base p-4 border border-warning/30 text-sm text-text-secondary">
              Published posts are available, but the first engagement snapshot has not been collected yet.
              The analytics job runs every six hours.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric title="Published Posts" value={number(data?.postedCount ?? 0)} icon={Send} />
            <Metric title="Measured Reach" value={number(data?.totals.reach ?? 0)} icon={TrendingUp} />
            <Metric title="Likes" value={number(data?.totals.likes ?? 0)} icon={Heart} />
            <Metric title="Comments" value={number(data?.totals.comments ?? 0)} icon={MessageCircle} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 surface-base p-6 min-h-[360px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-base font-semibold text-text-primary">Publishing Activity</h2>
                <span className="text-xs text-text-tertiary">Posts per day</span>
              </div>
              <div className="flex-1 flex items-end gap-2">
                {daily.map((item) => (
                  <div key={item.key} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                    <span className="text-[10px] text-text-secondary">{item.count || ""}</span>
                    <div
                      className="w-full max-w-10 min-h-1 rounded-t bg-accent-primary"
                      style={{ height: `${Math.max(3, (item.count / maxDaily) * 85)}%` }}
                    />
                    <span className="text-[9px] text-text-tertiary whitespace-nowrap">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-base overflow-hidden">
              <div className="p-5 border-b border-border-subtle">
                <h2 className="text-base font-semibold text-text-primary">Top Posts</h2>
              </div>
              {topPosts.length ? (
                <div className="divide-y divide-border-subtle">
                  {topPosts.map((post) => (
                    <div key={post.id} className="p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded bg-surface-strong overflow-hidden shrink-0">
                        {post.media?.mimeType?.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.media.thumbnailUrl ?? post.media.fileUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BarChart3 className="w-4 h-4 m-3.5 text-text-tertiary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/app/content/${post.contentItemId}`} className="text-xs font-semibold text-text-primary truncate block">
                          {post.title || "Untitled"}
                        </Link>
                        <p className="text-[10px] text-text-tertiary mt-1">
                          {post.capturedAt
                            ? `${number(post.metrics.interactions)} interactions`
                            : "Awaiting insight snapshot"}
                        </p>
                      </div>
                      {post.platformPostUrl && (
                        <a href={post.platformPostUrl} target="_blank" rel="noreferrer" className="action-btn">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-xs text-text-tertiary">
                  No content was published in this period.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <div className="surface-base p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{title}</p>
        <Icon className="w-4 h-4 text-accent-primary" />
      </div>
      <p className="text-2xl font-semibold text-text-primary mt-3">{value}</p>
    </div>
  );
}
