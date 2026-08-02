"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Film, Loader2, RotateCcw, Search, Trash2, UploadCloud, X } from "lucide-react";
import { MediaUploader } from "@/components/media/MediaUploader";
import { useToast } from "@/components/ui/use-toast";
import { useBrand } from "@/lib/brand-context";

interface MediaAsset {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize?: string | number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt?: string;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

function formatSize(value: MediaAsset["fileSize"]) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const { workspace, loading: workspaceLoading } = useBrand();
  const { toast } = useToast();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [uploads, setUploads] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [view, setView] = useState<"library" | "trash">("library");

  const loadAssets = useCallback(async () => {
    if (!workspace) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspaceId: workspace.id });
      if (view === "trash") params.set("view", "trash");
      const response = await fetch(`/api/media?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to load media");
      setAssets(json.data);
    } catch (error) {
      toast({
        title: "Media library could not be loaded",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, view, workspace]);

  useEffect(() => {
    // Data fetching intentionally synchronizes this client view with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAssets();
  }, [loadAssets]);

  const handleUploads = (next: MediaAsset[]) => {
    const fresh = next.filter((asset) => !uploads.some((existing) => existing.id === asset.id));
    setUploads(next);
    if (fresh.length) {
      setAssets((current) => [...fresh, ...current.filter((asset) => !fresh.some((item) => item.id === asset.id))]);
      toast({ title: `${fresh.length} file${fresh.length === 1 ? "" : "s"} uploaded` });
    }
  };

  const moveToTrash = async (asset: MediaAsset) => {
    if (!window.confirm(`Move "${asset.fileName || "this file"}" to Trash?`)) return;
    setDeletingId(asset.id);
    try {
      const response = await fetch(`/api/media/${asset.id}`, { method: "DELETE" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to delete media");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (preview?.id === asset.id) setPreview(null);
      const purgeAfter = json.data?.purgeAfter ? new Date(json.data.purgeAfter).toLocaleDateString() : null;
      toast({
        title: "Moved to Trash",
        description: purgeAfter ? `Permanent deletion is scheduled for ${purgeAfter}.` : undefined,
      });
    } catch (error) {
      toast({
        title: "Media was not deleted",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const restoreAsset = async (asset: MediaAsset) => {
    setRestoringId(asset.id);
    try {
      const response = await fetch(`/api/media/${asset.id}`, { method: "PATCH" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to restore media");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (preview?.id === asset.id) setPreview(null);
      toast({ title: "Media restored" });
    } catch (error) {
      toast({
        title: "Media was not restored",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const permanentlyDeleteAsset = async (asset: MediaAsset) => {
    if (!window.confirm(`Permanently delete "${asset.fileName || "this file"}"? This cannot be undone.`)) return;
    setDeletingId(asset.id);
    try {
      const response = await fetch(`/api/media/${asset.id}?permanent=true`, { method: "DELETE" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to permanently delete media");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (preview?.id === asset.id) setPreview(null);
      toast({ title: "Media permanently deleted", description: "The Vercel Blob file was also removed." });
    } catch (error) {
      toast({
        title: "Media was not permanently deleted",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) => asset.fileName?.toLowerCase().includes(normalized));
  }, [assets, query]);

  const busy = workspaceLoading || loading;

  return (
    <div className="h-full flex flex-col space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-text-tertiary text-xs mb-1">
            {assets.length} {view === "trash" ? "files in Trash" : "assets"}
          </p>
          <h1 className="text-[27px] font-semibold text-text-primary tracking-[-0.5px]">
            Media Library
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files…"
              className="h-9 w-52 sm:w-64 pl-9 pr-3 rounded-md bg-[rgba(0,0,0,0.2)] border border-border-default text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          {view === "library" && (
            <button onClick={() => setShowUpload((current) => !current)} className="btn-primary h-9">
              <UploadCloud className="w-4 h-4" />
              Upload Files
            </button>
          )}
        </div>
      </div>

      <div className="inline-flex self-start rounded-lg border border-border-default bg-surface-subtle p-1">
        <button
          type="button"
          onClick={() => {
            setView("library");
            setShowUpload(false);
            setPreview(null);
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            view === "library" ? "bg-surface-strong text-text-primary" : "text-text-tertiary"
          }`}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => {
            setView("trash");
            setShowUpload(false);
            setPreview(null);
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            view === "trash" ? "bg-surface-strong text-text-primary" : "text-text-tertiary"
          }`}
        >
          Trash
        </button>
      </div>

      {showUpload && view === "library" && workspace && (
        <section className="surface-base p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Upload media</h2>
              <p className="text-xs text-text-tertiary mt-1">Files are stored immediately and can be reused in any post.</p>
            </div>
            <button onClick={() => setShowUpload(false)} className="action-btn">
              <X className="w-4 h-4" />
            </button>
          </div>
          <MediaUploader
            workspaceId={workspace.id}
            media={uploads}
            onMediaChange={handleUploads}
            maxFiles={20}
          />
        </section>
      )}

      <section className="surface-base min-h-[500px]">
        {busy ? (
          <div className="min-h-[500px] flex items-center justify-center text-text-tertiary">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading media…
          </div>
        ) : filtered.length === 0 ? (
          view === "trash" ? (
            <div className="min-h-[500px] flex flex-col items-center justify-center text-text-tertiary">
              <Trash2 className="w-8 h-8 mb-3" />
              <span className="text-sm">{query ? "No deleted files match your search." : "Trash is empty."}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full min-h-[500px] flex flex-col items-center justify-center text-text-tertiary"
            >
              <UploadCloud className="w-8 h-8 mb-3" />
              <span className="text-sm">{query ? "No files match your search." : "Upload your first image or video."}</span>
            </button>
          )
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((asset) => {
              const isVideo = asset.mimeType?.startsWith("video/");
              return (
                <article key={asset.id} className="group min-w-0">
                  <div className="aspect-square rounded-xl bg-surface-strong border border-border-default overflow-hidden relative mb-2">
                    {isVideo ? (
                      <video src={asset.fileUrl} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailUrl ?? asset.fileUrl}
                        alt={asset.fileName ?? ""}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {isVideo && <Film className="absolute bottom-2 left-2 w-4 h-4 text-white drop-shadow" />}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPreview(asset)}
                        aria-label="Preview"
                        className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {view === "trash" ? (
                        <>
                          <button
                            onClick={() => void restoreAsset(asset)}
                            disabled={restoringId === asset.id || deletingId === asset.id}
                            aria-label="Restore"
                            title="Restore"
                            className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                          >
                            {restoringId === asset.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => void permanentlyDeleteAsset(asset)}
                            disabled={deletingId === asset.id || restoringId === asset.id}
                            aria-label="Delete permanently"
                            title="Delete permanently"
                            className="w-9 h-9 rounded-full bg-danger/80 text-white flex items-center justify-center hover:bg-danger"
                          >
                            {deletingId === asset.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void moveToTrash(asset)}
                          disabled={deletingId === asset.id}
                          aria-label="Move to Trash"
                          title="Move to Trash"
                          className="w-9 h-9 rounded-full bg-danger/80 text-white flex items-center justify-center hover:bg-danger"
                        >
                          {deletingId === asset.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">{asset.fileName || "Untitled file"}</p>
                  <p className="text-[10px] text-text-disabled mt-0.5">
                    {view === "trash" && asset.purgeAfter
                      ? `Deletes ${new Date(asset.purgeAfter).toLocaleDateString()}`
                      : `${asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}${formatSize(asset.fileSize)}`}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 p-6 flex items-center justify-center" onClick={() => setPreview(null)}>
          <button className="absolute right-6 top-6 text-white" onClick={() => setPreview(null)}>
            <X className="w-6 h-6" />
          </button>
          {preview.mimeType?.startsWith("video/") ? (
            <video src={preview.fileUrl} controls autoPlay className="max-w-full max-h-full rounded-xl" onClick={(event) => event.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.fileUrl} alt={preview.fileName ?? ""} className="max-w-full max-h-full rounded-xl" onClick={(event) => event.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}
