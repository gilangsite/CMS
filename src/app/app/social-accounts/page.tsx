"use client";

import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Smartphone,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  Loader2,
  Link2Off,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { useSocialAccounts, type RealSocialAccount } from "@/lib/hooks/useSocialAccounts";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export default function SocialAccountsPage() {
  const { toast } = useToast();
  const { workspace, loading: workspaceLoading } = useBrand();
  const { accounts, loading, refetch } = useSocialAccounts();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const error = parameters.get("error");
    const connected = parameters.get("connected");
    if (error) {
      toast({
        title: "Account connection failed",
        description: error.replaceAll("_", " "),
        variant: "destructive",
      });
    } else if (connected) {
      toast({ title: `${connected === "instagram" ? "Instagram" : "TikTok"} connected` });
    }
    if (error || connected) window.history.replaceState({}, "", window.location.pathname);
  }, [toast]);

  const connectedCount = accounts.filter((a) => a.status === "CONNECTED").length;

  const handleDisconnect = async (account: RealSocialAccount) => {
    setDisconnectingId(account.id);
    try {
      const platformPath = account.platform === "INSTAGRAM" ? "instagram" : "tiktok";
      const res = await fetch(`/api/social/${platformPath}/disconnect?id=${account.id}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to disconnect");
      toast({ title: "Account disconnected" });
      refetch();
    } catch (err) {
      toast({ title: "Disconnect failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">
            {loading ? "Loading…" : `${accounts.length} account${accounts.length === 1 ? "" : "s"} · ${connectedCount} connected`}
          </p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">Social Accounts</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platforms Overview */}
        <section className="surface-base p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(225,48,108,0.1)] flex items-center justify-center mb-4 text-[#E1306C]">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Instagram</h2>
          <p className="text-sm text-text-secondary mt-2 mb-6">
            Connect an Instagram Business or Creator account (linked to a Facebook Page) to enable direct publishing and analytics.
          </p>
          <a href="/api/social/instagram/connect" className="btn-secondary w-full justify-center">
            Connect Instagram
          </a>
        </section>

        <section className="surface-base p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(0,242,254,0.1)] flex items-center justify-center mb-4 text-[#00f2fe]">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">TikTok</h2>
          <p className="text-sm text-text-secondary mt-2 mb-6">
            Connect your TikTok account to upload drafts to your inbox. Note: sounds must be commercial-friendly.
          </p>
          <a href="/api/social/tiktok/connect" className="btn-secondary w-full justify-center">
            Connect TikTok
          </a>
        </section>
      </div>

      {/* Connected Accounts */}
      <section className="space-y-4 pt-4">
        <h2 className="text-lg font-bold text-text-primary">Connected Accounts</h2>

        {workspaceLoading || loading ? (
          <div className="surface-base p-12 flex items-center justify-center text-text-tertiary">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading accounts…
          </div>
        ) : !workspace ? (
          <div className="surface-base p-12 text-center text-sm text-text-tertiary">
            Setting up your workspace… refresh in a moment.
          </div>
        ) : accounts.length === 0 ? (
          <div className="surface-base p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-surface-subtle flex items-center justify-center mb-4 text-text-disabled">
              <Link2Off className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">No accounts connected yet</h3>
            <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
              Use the buttons above to connect your real Instagram or TikTok account. Nothing here is simulated —
              this list only shows accounts you&apos;ve actually authorized.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {accounts.map((account) => {
              const needsReconnect = account.status === "EXPIRED" || account.status === "ERROR" || account.status === "DISCONNECTED";
              const connectPath = account.platform === "INSTAGRAM" ? "instagram" : "tiktok";
              return (
                <div
                  key={account.id}
                  className={cn(
                    "surface-base p-5 flex flex-col transition-colors border",
                    needsReconnect ? "border-warning/50 bg-warning/5" : "border-border-default hover:border-border-strong"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {account.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={account.avatarUrl} className="w-10 h-10 rounded-full bg-surface-strong border border-border-default" alt="avatar" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-strong border border-border-default flex items-center justify-center text-text-tertiary text-xs font-semibold">
                          {(account.displayName || account.username || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-text-primary">{account.displayName || account.username || account.platformAccountId}</h3>
                        {account.username && <p className="text-xs text-text-secondary">@{account.username}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={account.status} />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="text-text-disabled hover:text-text-primary transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" className="w-44 surface-floating border border-border-default rounded-xl p-1 shadow-floating z-50 animate-fade-in text-sm">
                            <DropdownMenu.Item
                              onSelect={() => handleDisconnect(account)}
                              className="flex items-center gap-2 px-2 py-1.5 outline-none hover:bg-[rgba(255,120,138,0.1)] text-danger rounded cursor-pointer"
                            >
                              <Link2Off className="w-3.5 h-3.5" />
                              Disconnect
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">Platform</span>
                      <span className="text-text-secondary capitalize font-medium">{account.platform.toLowerCase()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">Assigned Brand</span>
                      <span className="text-text-secondary font-medium">{account.brand?.name ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">Last Synced</span>
                      <span className="text-text-secondary">
                        {account.lastSyncedAt ? format(parseISO(account.lastSyncedAt), "MMM d, h:mm a") : "Never"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border-subtle flex justify-between items-center">
                    {needsReconnect ? (
                      <>
                        <div className="flex items-center gap-1.5 text-xs text-warning font-medium">
                          <AlertCircle className="w-4 h-4" />
                          {account.status === "DISCONNECTED" ? "Disconnected" : "Needs reconnection"}
                        </div>
                        <a
                          href={`/api/social/${connectPath}/connect`}
                          className="btn-secondary h-8 px-3 text-xs bg-warning/10 text-warning hover:bg-warning/20 border-warning/20"
                        >
                          <RefreshCw className="w-3 h-3 mr-1.5" /> Reconnect
                        </a>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {disconnectingId === account.id ? "Disconnecting…" : "Connected"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Capability Matrix */}
      <section className="surface-base overflow-hidden">
        <div className="p-5 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">Platform Capabilities</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 font-medium text-text-secondary">Capability</th>
                <th className="px-5 py-3 font-medium text-text-secondary">Instagram</th>
                <th className="px-5 py-3 font-medium text-text-secondary">TikTok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {[
                { label: "Feed Image", ig: "supported", tt: "unavailable" },
                { label: "Reels / Video", ig: "supported", tt: "supported" },
                { label: "Carousel / Photo", ig: "supported", tt: "unavailable" },
                { label: "Story", ig: "supported", tt: "unavailable" },
                { label: "Native Music", ig: "semi_auto", tt: "semi_auto" },
                { label: "Direct Post", ig: "supported", tt: "experimental" },
                { label: "Draft Upload", ig: "unavailable", tt: "supported" },
                { label: "Insights", ig: "supported", tt: "experimental" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3 text-text-primary font-medium">{row.label}</td>
                  <td className="px-5 py-3"><CapabilityBadge level={row.ig} /></td>
                  <td className="px-5 py-3"><CapabilityBadge level={row.tt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const CAPABILITY_LEVELS: Record<string, { label: string; color: string }> = {
  supported: { label: "Supported", color: "#6FC6FF" },
  hybrid: { label: "Hybrid", color: "#7FA6FF" },
  semi_auto: { label: "Semi-Auto", color: "#A9C4F5" },
  experimental: { label: "Experimental", color: "#5B8DF0" },
  unavailable: { label: "Unavailable", color: "#858B97" },
};

function CapabilityBadge({ level }: { level: string }) {
  const cfg = CAPABILITY_LEVELS[level] ?? CAPABILITY_LEVELS.unavailable;
  return (
    <span
      className="inline-flex items-center gap-[5px] px-[9px] py-[3px] text-[11px] font-[550] rounded-[7px]"
      style={{ color: cfg.color, background: `${cfg.color}22` }}
    >
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}
