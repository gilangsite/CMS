"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Briefcase, Calendar, Loader2, Plus, Search, Target, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  startDate: string | null;
  endDate: string | null;
  brand: { id: string; name: string } | null;
  contentItems: { publishingStatus: string }[];
}

function campaignState(campaign: Campaign) {
  const now = new Date();
  if (campaign.startDate && new Date(campaign.startDate) > now) return "upcoming";
  if (campaign.endDate && new Date(campaign.endDate) < now) return "completed";
  return "active";
}

export default function CampaignsPage() {
  const { workspace, brands, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brandId: "",
    objective: "",
    startDate: "",
    endDate: "",
  });

  const loadCampaigns = useCallback(async () => {
    if (!workspace) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns?workspaceId=${workspace.id}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load campaigns");
      setCampaigns(json.data);
    } catch (error) {
      toast({
        title: "Campaigns could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, workspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCampaigns();
  }, [loadCampaigns]);

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    setSaving(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.name,
          brandId: form.brandId || null,
          objective: form.objective || null,
          startDate: form.startDate ? new Date(`${form.startDate}T00:00:00`).toISOString() : null,
          endDate: form.endDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null,
        }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to create campaign");
      setForm({ name: "", brandId: "", objective: "", startDate: "", endDate: "" });
      setShowForm(false);
      toast({ title: "Campaign created" });
      await loadCampaigns();
    } catch (error) {
      toast({
        title: "Campaign was not created",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? Existing content will be kept.`)) return;
    const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    const json = await response.json();
    if (!json.success) {
      toast({ title: "Campaign was not deleted", description: json.error, variant: "destructive" });
      return;
    }
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    toast({ title: "Campaign deleted" });
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return campaigns.filter(
      (campaign) =>
        !normalized ||
        campaign.name.toLowerCase().includes(normalized) ||
        campaign.brand?.name.toLowerCase().includes(normalized)
    );
  }, [campaigns, query]);
  const activeCount = campaigns.filter((campaign) => campaignState(campaign) === "active").length;
  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">{activeCount} active campaigns</p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">Campaigns</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search campaigns…"
              className="h-9 w-52 sm:w-64 pl-9 pr-3 rounded-md bg-black/20 border border-border-default text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary h-9">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="surface-base p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Create campaign</h2>
            <button type="button" onClick={() => setShowForm(false)} className="action-btn">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Campaign name" className="input-field" />
            <select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value })} className="input-field">
              <option value="">No brand</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="input-field" />
            <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="input-field" />
          </div>
          <textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} placeholder="Campaign objective" className="textarea-field min-h-20" />
          <button disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Campaign
          </button>
        </form>
      )}

      {busy ? (
        <div className="surface-base min-h-[320px] flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading campaigns…
        </div>
      ) : filtered.length === 0 ? (
        <button onClick={() => setShowForm(true)} className="surface-base border-2 border-dashed border-border-strong min-h-[280px] flex flex-col items-center justify-center">
          <Briefcase className="w-8 h-8 text-text-tertiary mb-3" />
          <span className="text-sm font-semibold text-text-primary">{query ? "No campaign matches your search" : "Create your first campaign"}</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((campaign) => {
            const state = campaignState(campaign);
            const posted = campaign.contentItems.filter((item) => item.publishingStatus === "POSTED").length;
            const progress = campaign.contentItems.length ? Math.round((posted / campaign.contentItems.length) * 100) : 0;
            return (
              <article key={campaign.id} className="surface-base p-5 flex flex-col hover-lift">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface-subtle text-text-secondary">{state}</span>
                      {campaign.brand && <span className="text-xs text-text-tertiary">{campaign.brand.name}</span>}
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{campaign.name}</h3>
                  </div>
                  <button onClick={() => void deleteCampaign(campaign)} className="action-btn text-danger" aria-label="Delete campaign">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 my-5 flex-1">
                  <div className="flex gap-3">
                    <Target className="w-4 h-4 text-text-tertiary mt-0.5" />
                    <p className="text-sm text-text-secondary">{campaign.objective || "No objective added."}</p>
                  </div>
                  <div className="flex gap-3">
                    <Calendar className="w-4 h-4 text-text-tertiary mt-0.5" />
                    <p className="text-sm text-text-secondary">
                      {campaign.startDate ? format(new Date(campaign.startDate), "MMM d, yyyy") : "No start date"}
                      {" – "}
                      {campaign.endDate ? format(new Date(campaign.endDate), "MMM d, yyyy") : "Open ended"}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-border-subtle">
                  <div className="flex justify-between text-xs text-text-secondary mb-2">
                    <span>{posted} of {campaign.contentItems.length} posted</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                    <div className="h-full bg-accent-primary" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
