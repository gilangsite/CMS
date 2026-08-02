"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Plus,
  Search,
  MoreHorizontal,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  PenLine,
  FileImage,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ApprovalStatus, Platform, PublishingStatus } from "@prisma/client";

interface ContentListItem {
  id: string;
  title: string | null;
  approvalStatus: ApprovalStatus;
  publishingStatus: PublishingStatus;
  scheduledAt: string | null;
  updatedAt: string;
  brand: { id: string; name: string } | null;
  creator: { id: string; name: string | null; avatarUrl: string | null } | null;
  contentAssets: {
    mediaAsset: {
      fileUrl: string;
      thumbnailUrl: string | null;
      mimeType: string | null;
    };
  }[];
  platformPosts: {
    platform: Platform;
    destination: string;
    status: PublishingStatus;
    errorMessage: string | null;
    socialAccount: {
      platform: Platform;
      username: string | null;
      displayName: string | null;
    };
  }[];
}

type ContentFilter =
  | "all"
  | "in_review"
  | "scheduled"
  | "posted"
  | "needs_action"
  | "draft";

function matchesFilter(item: ContentListItem, filter: ContentFilter) {
  switch (filter) {
    case "in_review":
      return item.approvalStatus === "IN_REVIEW";
    case "scheduled":
      return item.publishingStatus === "SCHEDULED";
    case "posted":
      return item.publishingStatus === "POSTED";
    case "needs_action":
      return (
        item.publishingStatus === "FAILED" ||
        item.publishingStatus === "NEEDS_MANUAL_FINALIZATION"
      );
    case "draft":
      return item.publishingStatus === "DRAFT";
    default:
      return true;
  }
}

export default function ContentPage() {
  const { workspace, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [items, setItems] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "grid">("table");
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      if (!json.success) throw new Error(json.error ?? "Unable to load content");
      setItems(json.data);
    } catch (error) {
      toast({
        title: "Content could not be loaded",
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

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        matchesFilter(item, filter) &&
        (!normalizedQuery ||
          (item.title ?? "Untitled").toLowerCase().includes(normalizedQuery) ||
          item.platformPosts.some((post) =>
            (post.socialAccount.username ?? "").toLowerCase().includes(normalizedQuery)
          ))
    );
  }, [filter, items, query]);

  const filterChips: { key: ContentFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_review", label: "In Review" },
    { key: "scheduled", label: "Scheduled" },
    { key: "posted", label: "Posted" },
    { key: "needs_action", label: "Needs Action" },
    { key: "draft", label: "Drafts" },
  ];

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === filtered.length
        ? new Set()
        : new Set(filtered.map((item) => item.id))
    );
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const deleteItems = async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} content item${ids.length === 1 ? "" : "s"}?`)) {
      return;
    }
    const responses = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`/api/content/${id}`, { method: "DELETE" });
        const json = await response.json();
        return { id, ...json };
      })
    );
    const failures = responses.filter((result) => !result.success);
    if (failures.length) {
      toast({
        title: "Some items could not be deleted",
        description: failures.map((failure) => failure.error).filter(Boolean).join(" "),
        variant: "destructive",
      });
    } else {
      toast({ title: `${ids.length} item${ids.length === 1 ? "" : "s"} deleted` });
    }
    setSelectedIds(new Set());
    await loadItems();
  };

  const submitSelected = async () => {
    const responses = await Promise.all(
      [...selectedIds].map(async (id) => {
        const response = await fetch(`/api/content/${id}/submit-review`, { method: "POST" });
        return response.json();
      })
    );
    const failures = responses.filter((result) => !result.success);
    toast(
      failures.length
        ? {
            title: "Some items were not submitted",
            description: failures.map((failure) => failure.error).join(" "),
            variant: "destructive",
          }
        : { title: "Selected content submitted for review" }
    );
    setSelectedIds(new Set());
    await loadItems();
  };

  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">
            {busy ? "Loading…" : `${items.length} items`}
          </p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">
            Content
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-0.5 bg-black/20 border border-border-default rounded-md">
            <button
              onClick={() => setView("table")}
              className={cn(
                "px-2.5 py-1.5 text-xs rounded",
                view === "table" ? "bg-surface-hover text-text-primary" : "text-text-secondary"
              )}
              aria-label="Table view"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "px-2.5 py-1.5 text-xs rounded",
                view === "grid" ? "bg-surface-hover text-text-primary" : "text-text-secondary"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => void loadItems()} className="action-btn h-9 w-9" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search content..."
              className="h-9 w-48 sm:w-64 pl-9 pr-3 rounded-md bg-black/20 border border-border-default text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <Link href="/app/content/new" className="btn-primary h-9">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Content</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5",
              filter === chip.key
                ? "bg-accent-primary/16 border-accent-primary/30 text-text-primary"
                : "bg-surface-subtle border-border-subtle text-text-secondary"
            )}
          >
            {chip.label}
            <span className="text-text-disabled">
              {items.filter((item) => matchesFilter(item, chip.key)).length}
            </span>
          </button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="surface-floating py-2 px-4 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button onClick={() => void submitSelected()} className="btn-secondary h-8 text-xs">
              Submit Review
            </button>
            <button
              onClick={() => void deleteItems([...selectedIds])}
              className="btn-ghost h-8 text-xs text-danger"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {busy ? (
        <div className="surface-base flex-1 min-h-[320px] flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading content…
        </div>
      ) : view === "table" ? (
        <div className="surface-base overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/[0.02] border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-text-secondary">Content</th>
                  <th className="px-4 py-3 text-text-secondary">Brand</th>
                  <th className="px-4 py-3 text-text-secondary">Destination</th>
                  <th className="px-4 py-3 text-text-secondary">Approval</th>
                  <th className="px-4 py-3 text-text-secondary">Publishing</th>
                  <th className="px-4 py-3 text-text-secondary">Schedule</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((item) => {
                  const media = item.contentAssets[0]?.mediaAsset;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-surface-strong overflow-hidden flex items-center justify-center">
                            {media?.mimeType?.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={media.thumbnailUrl ?? media.fileUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileImage className="w-4 h-4 text-text-tertiary" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/app/content/${item.id}`}
                              className="font-medium text-text-primary hover:underline block max-w-[240px] truncate"
                            >
                              {item.title || "Untitled"}
                            </Link>
                            <span className="text-xs text-text-tertiary">
                              {item.creator?.name ?? "Unknown creator"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{item.brand?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {item.platformPosts
                          .map((post) => post.destination.replace(/_/g, " "))
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.approvalStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.publishingStatus} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {item.scheduledAt
                          ? format(new Date(item.scheduledAt), "MMM d, h:mm a")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="action-btn h-8 w-8" aria-label="Content actions">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              className="w-44 surface-floating border border-border-default rounded-xl p-1 z-50"
                            >
                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/app/content/${item.id}/edit`}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none hover:bg-surface-hover"
                                >
                                  <PenLine className="w-4 h-4" /> Edit
                                </Link>
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => void deleteItems([item.id])}
                                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none text-danger hover:bg-danger/10"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-text-tertiary">
              No content matches this filter.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {filtered.map((item) => {
            const media = item.contentAssets[0]?.mediaAsset;
            return (
              <Link
                key={item.id}
                href={`/app/content/${item.id}`}
                className="surface-base overflow-hidden hover-lift"
              >
                <div className="h-36 bg-surface-strong relative flex items-center justify-center overflow-hidden">
                  {media?.mimeType?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.thumbnailUrl ?? media.fileUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-8 h-8 text-text-disabled" />
                  )}
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={item.publishingStatus} />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-text-primary line-clamp-2">
                    {item.title || "Untitled"}
                  </h3>
                  <div className="flex justify-between mt-3 text-xs text-text-tertiary">
                    <span>{item.brand?.name ?? "No brand"}</span>
                    <span>{format(new Date(item.updatedAt), "MMM d")}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
