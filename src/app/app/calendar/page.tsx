"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, Plus } from "lucide-react";
import type { PublishingStatus } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { cn } from "@/lib/utils";

interface CalendarItem {
  id: string;
  title: string | null;
  scheduledAt: string | null;
  publishingStatus: PublishingStatus;
  platformPosts: {
    destination: string;
    caption: string | null;
    postMode: string;
  }[];
}

export default function CalendarPage() {
  const { workspace, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"month" | "queue">("month");
  const [items, setItems] = useState<CalendarItem[]>([]);
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
      const response = await fetch(`/api/content?workspaceId=${workspace.id}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load calendar");
      setItems(
        (json.data as CalendarItem[]).filter(
          (item) =>
            item.scheduledAt &&
            !["DRAFT", "PENDING_APPROVAL", "CANCELLED"].includes(item.publishingStatus)
        )
      );
    } catch (error) {
      toast({
        title: "Calendar could not be loaded",
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

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth]
  );

  const reschedule = async (item: CalendarItem, targetDate: Date) => {
    if (!item.scheduledAt || ["POSTED", "POSTING", "PROCESSING"].includes(item.publishingStatus)) {
      toast({
        title: "This post cannot be rescheduled",
        description: "Only content waiting in the publishing queue can be moved.",
        variant: "destructive",
      });
      return;
    }
    const previous = item.scheduledAt;
    const original = parseISO(previous);
    const next = new Date(targetDate);
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);
    setActingId(item.id);
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, scheduledAt: next.toISOString() } : candidate
      )
    );
    try {
      const response = await fetch(`/api/content/${item.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: next.toISOString() }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to reschedule content");
      toast({
        title: "Content rescheduled",
        description: `${item.title || "Untitled"} will publish ${format(next, "MMM d, yyyy 'at' h:mm a")}.`,
      });
    } catch (error) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, scheduledAt: previous } : candidate
        )
      );
      toast({
        title: "Content was not rescheduled",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const handleDrop = (event: React.DragEvent, targetDate: Date) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/content-id");
    const item = items.find((candidate) => candidate.id === id);
    if (item) void reschedule(item, targetDate);
  };

  const unschedule = async (item: CalendarItem) => {
    setActingId(item.id);
    try {
      const response = await fetch(`/api/content/${item.id}/unschedule`, { method: "POST" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to unschedule content");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      toast({ title: "Schedule removed", description: "The content is back in the approved queue." });
    } catch (error) {
      toast({
        title: "Schedule was not removed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const queue = [...items].sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  );
  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">
            {format(currentMonth, "MMMM yyyy")} · {queue.length} scheduled
          </p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">
            Calendar
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-0.5 bg-[rgba(0,0,0,0.2)] border border-border-default rounded-md">
            <button
              onClick={() => setView("month")}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded flex items-center gap-2",
                view === "month" ? "bg-surface-hover text-text-primary" : "text-text-secondary"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Month
            </button>
            <button
              onClick={() => setView("queue")}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded flex items-center gap-2",
                view === "queue" ? "bg-surface-hover text-text-primary" : "text-text-secondary"
              )}
            >
              <List className="w-3.5 h-3.5" /> Queue
            </button>
          </div>
          <Link href="/app/content/new" className="btn-primary h-9">
            <Plus className="w-4 h-4" /> New Content
          </Link>
        </div>
      </div>

      {busy ? (
        <div className="surface-base min-h-[440px] flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading calendar…
        </div>
      ) : view === "month" ? (
        <div className="surface-base overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="action-btn h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="btn-secondary h-8 px-3 text-xs">
                Today
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="action-btn h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border-subtle">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-text-secondary">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, index) => (
              <div key={`start-${index}`} className="min-h-[120px] border-b border-r border-border-subtle" />
            ))}
            {daysInMonth.map((day) => {
              const dayItems = queue.filter((item) => isSameDay(parseISO(item.scheduledAt!), day));
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, day)}
                  className="min-h-[120px] border-b border-r border-border-subtle p-2 hover:bg-surface-hover"
                >
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2",
                      isToday(day) && "bg-accent-primary text-black"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1.5">
                    {dayItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/app/content/${item.id}`}
                        draggable={!["POSTED", "POSTING", "PROCESSING"].includes(item.publishingStatus)}
                        onDragStart={(event) => event.dataTransfer.setData("text/content-id", item.id)}
                        className={cn(
                          "block p-1.5 rounded bg-surface-strong border border-border-default",
                          actingId === item.id && "opacity-50"
                        )}
                      >
                        <p className="text-[10px] text-text-secondary">
                          {format(parseISO(item.scheduledAt!), "h:mm a")}
                        </p>
                        <p className="text-xs text-text-primary font-medium truncate">
                          {item.title || "Untitled"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="surface-base p-12 text-center text-sm text-text-tertiary min-h-[300px]">
          No scheduled content yet.
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => {
            const post = item.platformPosts[0];
            return (
              <div key={item.id} className="surface-base p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-accent-primary">
                      {format(parseISO(item.scheduledAt!), "EEEE, MMM d 'at' h:mm a")}
                    </span>
                    <StatusBadge status={item.publishingStatus} />
                    {post?.postMode && (
                      <span className="text-[10px] text-text-disabled uppercase">
                        {post.postMode.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">{item.title || "Untitled"}</h3>
                  <p className="text-xs text-text-secondary truncate mt-1">{post?.caption || "No caption"}</p>
                  <p className="text-[10px] text-text-disabled mt-2">
                    {item.platformPosts.map((candidate) => candidate.destination.replaceAll("_", " ")).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/app/content/${item.id}`} className="btn-secondary h-8 px-3 text-xs">
                    View
                  </Link>
                  {!["POSTED", "POSTING", "PROCESSING"].includes(item.publishingStatus) && (
                    <button
                      onClick={() => void unschedule(item)}
                      disabled={actingId === item.id}
                      className="btn-secondary h-8 px-3 text-xs text-danger"
                    >
                      {actingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Unschedule"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
