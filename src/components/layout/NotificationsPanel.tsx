"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, Check, CheckCircle2, Clock, FileEdit, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  link: string | null;
  read: boolean;
}

const TYPE_STYLE: Record<string, { icon: React.ElementType; tint: string; color: string }> = {
  approval_requested: { icon: CheckCircle2, tint: "rgba(121,184,255,.14)", color: "#79B8FF" },
  publishing_failed: { icon: AlertCircle, tint: "rgba(255,120,138,.14)", color: "#FF788A" },
  draft_ready: { icon: FileEdit, tint: "rgba(169,196,245,.14)", color: "#A9C4F5" },
  posted: { icon: Check, tint: "rgba(111,198,255,.14)", color: "#6FC6FF" },
  token_expiring: { icon: Clock, tint: "rgba(255,190,92,.14)", color: "#FFBE5C" },
};

function styleFor(type: string) {
  return TYPE_STYLE[type] ?? { icon: Bell, tint: "rgba(126,160,235,.14)", color: "#7FA6FF" };
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export function NotificationsPanel({
  notifications,
  loading,
  onRead,
  onReadAll,
  onClose,
}: {
  notifications: AppNotification[];
  loading: boolean;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[110] bg-black/40 animate-fade-in">
      <div onClick={(event) => event.stopPropagation()} className="absolute top-0 right-0 w-full sm:w-[400px] h-full border-l border-border-default bg-surface-strong shadow-[-20px_0_60px_rgba(0,0,0,.5)] flex flex-col">
        <div className="px-5 py-[18px] border-b border-border-subtle flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Notifications</div>
            <div className="text-[11.5px] text-text-tertiary mt-0.5">{unreadCount} unread</div>
          </div>
          {unreadCount > 0 && (
            <button onClick={onReadAll} className="text-[11.5px] text-accent-primary hover:underline">
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-surface-hover flex items-center justify-center text-text-secondary">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-8 text-center text-sm text-text-tertiary">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-tertiary">No notifications right now.</div>
          ) : (
            notifications.map((notification) => {
              const { icon: Icon, tint, color } = styleFor(notification.type);
              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    onRead(notification.id);
                    if (notification.link) router.push(notification.link);
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl text-left hover:bg-surface-hover",
                    !notification.read && "bg-surface-subtle"
                  )}
                >
                  <span className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: tint }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] text-text-primary leading-[1.35]">{notification.message}</span>
                    <span className="block text-[11px] text-text-disabled mt-[3px]">{timeAgo(notification.createdAt)}</span>
                  </span>
                  {!notification.read && <span className="w-[7px] h-[7px] rounded-full bg-accent-primary mt-1.5" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
