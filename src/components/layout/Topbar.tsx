"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Plus } from "lucide-react";
import { useBrand } from "@/lib/brand-context";
import { openCommandPalette } from "@/lib/palette-store";
import { NotificationsPanel, type AppNotification } from "@/components/layout/NotificationsPanel";

export function Topbar() {
  const pathname = usePathname();
  const { workspace, activeBrand } = useBrand();
  const contextLabel = activeBrand?.name ?? workspace?.name ?? "";
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/notifications?workspaceId=${workspace.id}`, { cache: "no-store" });
        const json = await response.json();
        if (!cancelled && json.success) {
          let storedReadIds: string[] = [];
          try {
            const stored = JSON.parse(
              window.localStorage.getItem(`read-notifications:${workspace.id}`) ?? "[]"
            );
            if (Array.isArray(stored)) storedReadIds = stored.filter((id): id is string => typeof id === "string");
          } catch {
            window.localStorage.removeItem(`read-notifications:${workspace.id}`);
          }
          const readIds = new Set(storedReadIds);
          setNotifications(
            json.data.map((notification: Omit<AppNotification, "read">) => ({
              ...notification,
              read: readIds.has(notification.id),
            }))
          );
        }
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  const persistRead = (next: AppNotification[]) => {
    setNotifications(next);
    if (workspace) {
      window.localStorage.setItem(
        `read-notifications:${workspace.id}`,
        JSON.stringify(next.filter((notification) => notification.read).map((notification) => notification.id))
      );
    }
  };

  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) return "Dashboard";
    if (pathname.includes("/calendar")) return "Calendar";
    if (pathname.includes("/content/new")) return "Create Content";
    if (pathname.includes("/content")) return "Content";
    if (pathname.includes("/media")) return "Media Library";
    if (pathname.includes("/campaigns")) return "Campaigns";
    if (pathname.includes("/approvals")) return "Approvals";
    if (pathname.includes("/social-accounts")) return "Social Accounts";
    if (pathname.includes("/analytics")) return "Analytics";
    if (pathname.includes("/settings")) return "Settings";
    return "Content Command";
  };
  const pageTitle = getPageTitle();

  return (
    <>
      <header className="h-[60px] shrink-0 flex items-center gap-3.5 px-6 border-b border-border-subtle bg-[rgba(10,12,16,.6)] backdrop-blur-[18px] z-20 sticky top-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-[7px] text-[11px] text-text-tertiary">
            <span>{contextLabel}</span>
            <span className="opacity-50">/</span>
            <span className="text-text-secondary">{pageTitle}</span>
          </div>
          <div className="text-[16px] font-semibold tracking-tight">{pageTitle}</div>
        </div>

        <div className="flex-1" />

        <button
          onClick={openCommandPalette}
          className="hidden md:flex items-center gap-[9px] h-9 px-3 rounded-[10px] bg-surface-subtle border border-border-subtle text-text-tertiary hover:border-border-default transition-colors text-[12.5px]"
        >
          <Search className="w-[15px] h-[15px]" />
          <span>Search or run a command</span>
          <span className="flex gap-0.5 ml-4">
            <kbd className="font-mono text-[10px] bg-surface-hover border border-border-subtle rounded px-[5px] py-[1px]">⌘</kbd>
            <kbd className="font-mono text-[10px] bg-surface-hover border border-border-subtle rounded px-[5px] py-[1px]">K</kbd>
          </span>
        </button>

        <button
          onClick={openCommandPalette}
          className="md:hidden w-9 h-9 rounded-[10px] bg-surface-subtle border border-border-subtle flex items-center justify-center text-text-secondary"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => setNotifOpen(true)}
          className="relative w-9 h-9 rounded-[10px] bg-surface-subtle border border-border-subtle text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors"
        >
          <Bell className="w-[17px] h-[17px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-[3px] -right-[3px] min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9.5px] font-bold flex items-center justify-center border-2 border-background-base">
              {unreadCount}
            </span>
          )}
        </button>

        <Link
          href="/app/content/new"
          className="h-9 px-[15px] rounded-[10px] bg-gradient-primary text-white font-semibold text-[12.5px] flex items-center gap-[7px] shadow-[0_4px_16px_rgba(127,166,255,.28)] hover:opacity-90 transition-opacity"
        >
          <Plus className="w-[15px] h-[15px]" strokeWidth={2.4} />
          <span>New</span>
        </Link>
      </header>

      {notifOpen && (
        <NotificationsPanel
          notifications={notifications}
          loading={notificationsLoading}
          onRead={(id) =>
            persistRead(
              notifications.map((notification) =>
                notification.id === id ? { ...notification, read: true } : notification
              )
            )
          }
          onReadAll={() =>
            persistRead(notifications.map((notification) => ({ ...notification, read: true })))
          }
          onClose={() => setNotifOpen(false)}
        />
      )}
    </>
  );
}
