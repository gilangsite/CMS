"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Palette,
  Plus,
  Send,
  Shield,
  Smartphone,
  Users,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";
import { useSocialAccounts } from "@/lib/hooks/useSocialAccounts";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { workspace, brands, loading: workspaceLoading, refetchBrands } = useBrand();
  const { accounts } = useSocialAccounts();
  const [activeTab, setActiveTab] = useState("workspace");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/workspaces/${workspace.id}/members`, { cache: "no-store" });
      const json = await response.json();
      if (!cancelled && json.success) setMembers(json.data);
      if (!cancelled) setMembersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  const renameWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    setSavingWorkspace(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to update workspace");
      toast({ title: "Workspace updated", description: "Refresh the page to see the new name everywhere." });
    } catch (error) {
      toast({
        title: "Workspace was not updated",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const addBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace || !brandName.trim()) return;
    setSavingBrand(true);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, name: brandName }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to create brand");
      setBrandName("");
      refetchBrands();
      toast({ title: "Brand created" });
    } catch (error) {
      toast({
        title: "Brand was not created",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingBrand(false);
    }
  };

  const tabs = [
    { id: "workspace", label: "Workspace", icon: Building2 },
    { id: "team", label: "Team", icon: Users },
    { id: "brands", label: "Brands", icon: Palette },
    { id: "publishing", label: "Publishing", icon: Send },
    { id: "integrations", label: "Integrations", icon: Smartphone },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <p className="text-text-tertiary text-xs mb-1">{workspace?.name ?? "Loading workspace…"}</p>
        <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">Settings</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-[220px] shrink-0">
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left",
                  activeTab === tab.id ? "bg-surface-hover text-text-primary" : "text-text-secondary"
                )}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === "workspace" && (
            <section className="surface-base p-6">
              <h2 className="text-base font-semibold text-text-primary mb-6">Workspace Details</h2>
              {workspaceLoading || !workspace ? (
                <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
              ) : (
                <form key={workspace.id} onSubmit={renameWorkspace} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Workspace name</label>
                    <input name="name" defaultValue={workspace.name} required className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Workspace slug</label>
                    <input value={workspace.slug} readOnly className="input-field opacity-70" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Publishing timezone</label>
                    <input value="Asia/Jakarta (WIB, UTC+7)" readOnly className="input-field opacity-70" />
                  </div>
                  <button disabled={savingWorkspace} className="btn-primary">
                    {savingWorkspace && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
                  </button>
                </form>
              )}
            </section>
          )}

          {activeTab === "team" && (
            <section className="surface-base overflow-hidden">
              <div className="p-6 border-b border-border-subtle">
                <h2 className="text-base font-semibold text-text-primary">Team Members</h2>
                <p className="text-xs text-text-tertiary mt-1">
                  Membership is read-only here. Add users through the configured identity provider.
                </p>
              </div>
              {membersLoading ? (
                <div className="p-8 text-text-tertiary"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {members.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {member.user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center">
                            {(member.user.name || member.user.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-text-primary">{member.user.name || member.user.email}</p>
                          <p className="text-xs text-text-tertiary">{member.user.email}</p>
                        </div>
                      </div>
                      <span className="text-xs text-text-secondary">{member.role.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "brands" && (
            <div className="space-y-5">
              <form onSubmit={addBrand} className="surface-base p-5 flex flex-col sm:flex-row gap-3">
                <input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="New brand name" required className="input-field flex-1" />
                <button disabled={savingBrand} className="btn-primary">
                  {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Brand
                </button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brands.map((brand) => (
                  <div key={brand.id} className="surface-base p-5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold" style={{ background: brand.color }}>
                      {brand.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{brand.name}</p>
                      <p className="text-xs text-text-tertiary">{brand.description || "No description"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "publishing" && (
            <section className="surface-base p-6 space-y-4">
              <h2 className="text-base font-semibold text-text-primary">Active Publishing Rules</h2>
              <Fact label="Schedule processor" value="Runs every minute" />
              <Fact label="Missed schedules" value="Fail safely after 24 hours" />
              <Fact label="Instagram media" value="Public URL with automatic JPEG normalization" />
              <Fact label="TikTok" value="Draft upload by default; finalize in TikTok" />
              <Fact label="Publishing simulation" value="Off" />
            </section>
          )}

          {activeTab === "integrations" && (
            <section className="surface-base overflow-hidden">
              <div className="p-6 border-b border-border-subtle">
                <h2 className="text-base font-semibold text-text-primary">Connected Social Accounts</h2>
              </div>
              <div className="divide-y divide-border-subtle">
                {accounts.length ? accounts.map((account) => (
                  <div key={account.id} className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {account.displayName || account.username || account.platformAccountId}
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">{account.platform} · {account.status}</p>
                    </div>
                    <CheckCircle2 className={cn("w-5 h-5", account.status === "CONNECTED" ? "text-success" : "text-warning")} />
                  </div>
                )) : (
                  <div className="p-8 text-sm text-text-tertiary">No social accounts connected.</div>
                )}
              </div>
              <a href="/app/social-accounts" className="btn-secondary m-5 inline-flex">Manage Accounts</a>
            </section>
          )}

          {activeTab === "security" && (
            <section className="surface-base p-6 space-y-5">
              <h2 className="text-base font-semibold text-text-primary">Security Controls</h2>
              <div className="flex gap-3">
                <KeyRound className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Encrypted platform tokens</p>
                  <p className="text-xs text-text-tertiary mt-1">Access and refresh tokens are encrypted at rest and never sent to the browser.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Verified callbacks</p>
                  <p className="text-xs text-text-tertiary mt-1">OAuth state and Meta/TikTok webhook signatures are verified before changes are accepted.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border-subtle last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right">{value}</span>
    </div>
  );
}
