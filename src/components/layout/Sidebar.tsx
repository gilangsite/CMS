"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Image as ImageIcon,
  Megaphone,
  ClipboardCheck,
  Users,
  LineChart,
  Settings,
  Plus,
  ChevronLeft,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useBrand } from "@/lib/brand-context";
import { useSocialAccounts } from "@/lib/hooks/useSocialAccounts";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

const NAV_MAIN = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/app/calendar", icon: Calendar },
  { label: "Content", href: "/app/content", icon: FileText },
  { label: "Media Library", href: "/app/media", icon: ImageIcon },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone },
];

const NAV_OPS_BASE = [
  { label: "Approvals", href: "/app/approvals", icon: ClipboardCheck },
  { label: "Social Accounts", href: "/app/social-accounts", icon: Users },
  { label: "Analytics", href: "/app/analytics", icon: LineChart },
];

const NAV_SYS = [{ label: "Settings", href: "/app/settings", icon: Settings }];

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  count?: number;
  danger?: boolean;
}

function NavGroup({
  title,
  items,
  pathname,
  expanded,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  expanded: boolean;
}) {
  return (
    <div>
      {expanded && (
        <div className="px-2.5 pt-3.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-text-tertiary">
          {title}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const count = "count" in item ? item.count : undefined;
          const danger = "danger" in item ? item.danger : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-[11px] px-2.5 py-2 rounded-[9px] border transition-colors",
                isActive
                  ? "text-[#F7F8FA] border-accent-primary/25 bg-gradient-to-br from-accent-primary/15 to-accent-secondary/10"
                  : "text-text-secondary border-transparent hover:bg-white/[0.03] hover:text-text-primary",
                !expanded && "justify-center px-0"
              )}
            >
              <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={1.9} />
              {expanded && <span className="flex-1 text-[13px]">{item.label}</span>}
              {expanded && !!count && (
                <span
                  className={cn(
                    "min-w-[19px] h-[18px] px-1 rounded-[9px] text-[10.5px] font-semibold flex items-center justify-center",
                    danger
                      ? "bg-danger/16 text-danger"
                      : "bg-accent-primary/16 text-[#C9D2FF]"
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const expanded = !isCollapsed;
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const { workspace, brands, activeBrand, setActiveBrandId } = useBrand();
  const { user } = useUser();
  const { accounts } = useSocialAccounts();
  const [approvalCount, setApprovalCount] = useState(0);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(
        `/api/content?workspaceId=${workspace.id}&approvalStatus=IN_REVIEW`,
        { cache: "no-store" }
      );
      const json = await response.json();
      if (!cancelled && json.success) setApprovalCount(json.data.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, workspace]);

  const switcherLabel = activeBrand?.name ?? workspace?.name ?? "Loading…";
  const switcherCaption = activeBrand ? "Brand" : "Workspace";
  const switcherColor = activeBrand?.color ?? "linear-gradient(135deg,#5b8def,#3f6fd8)";

  const accountsNeedingAction = accounts.filter(
    (a) => a.status === "EXPIRED" || a.status === "ERROR" || a.status === "DISCONNECTED"
  ).length;
  const navOps: NavItem[] = NAV_OPS_BASE.map((item) => {
    if (item.label === "Approvals" && approvalCount > 0) return { ...item, count: approvalCount };
    if (item.label === "Social Accounts" && accountsNeedingAction > 0) {
      return { ...item, count: accountsNeedingAction, danger: true };
    }
    return item;
  });

  return (
    <aside
      className={cn(
        "relative flex flex-col shrink-0 h-screen sticky top-0 transition-[width] duration-200 ease-[cubic-bezier(.22,1,.36,1)] border-r border-border-subtle bg-gradient-to-b from-[rgba(15,18,24,.72)] to-[rgba(10,12,16,.72)] backdrop-blur-[22px]",
        expanded ? "w-[244px]" : "w-[72px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-[11px] px-[18px] pt-5 pb-[18px]">
        <div className="w-[30px] h-[30px] rounded-[9px] bg-gradient-primary flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(127,166,255,.35)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 7v10l8 5 8-5V7z" />
            <path d="M12 22V12M4 7l8 5 8-5" />
          </svg>
        </div>
        {expanded && (
          <div className="flex flex-col leading-[1.05] min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate">Content Command</span>
            <span className="text-[10.5px] text-text-tertiary uppercase tracking-[0.14em] mt-0.5">Social Ops</span>
          </div>
        )}
      </div>

      {/* Workspace / brand switcher */}
      <div className="px-3 pb-3 relative">
        <button
          onClick={() => brands.length > 0 && setBrandMenuOpen((v) => !v)}
          className={cn(
            "flex items-center w-full gap-2 rounded-[10px] border border-border-default bg-black/20 transition-colors",
            brands.length > 0 && "hover:bg-surface-hover",
            expanded ? "px-2.5 py-[7px] justify-between" : "p-1.5 justify-center"
          )}
        >
          <div
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
            style={{ background: switcherColor }}
          >
            {switcherLabel.charAt(0)}
          </div>
          {expanded && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12.5px] font-medium truncate">{switcherLabel}</div>
                <div className="text-[10.5px] text-text-tertiary">{switcherCaption}</div>
              </div>
              {brands.length > 0 && <ChevronsUpDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />}
            </>
          )}
        </button>

        {brandMenuOpen && expanded && brands.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1.5 z-30 rounded-xl border border-border-strong bg-surface-strong backdrop-blur-[24px] shadow-[0_18px_44px_rgba(0,0,0,.5)] p-1.5 animate-scale-in">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBrandId(b.id);
                  setBrandMenuOpen(false);
                }}
                className="flex items-center w-full gap-2 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <div
                  className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                  style={{ background: b.color }}
                >
                  {b.name.charAt(0)}
                </div>
                <span className="flex-1 text-left text-[12.5px]">{b.name}</span>
                {b.id === activeBrand?.id && <Check className="w-3.5 h-3.5 text-accent-primary" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick create */}
      <div className="px-3 pb-3.5">
        <Link
          href="/app/content/new"
          className="flex items-center justify-center gap-2 w-full h-[38px] rounded-[10px] bg-gradient-primary text-white font-semibold text-[13px] shadow-[0_6px_18px_-4px_rgba(62,99,216,.5),inset_0_1px_0_rgba(255,255,255,.3)] hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          {expanded && <span>New Content</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 flex flex-col gap-0.5 scrollbar-none">
        <NavGroup title="Workspace" items={NAV_MAIN} pathname={pathname} expanded={expanded} />
        <NavGroup title="Operations" items={navOps} pathname={pathname} expanded={expanded} />
        <NavGroup title="System" items={NAV_SYS} pathname={pathname} expanded={expanded} />
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border-subtle flex items-center gap-2.5">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "You"}
            className="w-8 h-8 rounded-[9px] object-cover shrink-0 border border-border-default"
          />
        ) : (
          <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-[#3a4668] to-[#3E5A9E] flex items-center justify-center text-xs font-semibold shrink-0">
            {(user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        {expanded && (
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium truncate">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || "…"}
            </div>
            <div className="text-[10.5px] text-text-tertiary">Owner</div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title="Collapse"
          className="flex items-center justify-center p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronLeft
            className={cn("w-4 h-4 transition-transform duration-200", isCollapsed && "rotate-180")}
          />
        </button>
      </div>
    </aside>
  );
}
