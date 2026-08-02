"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Film, Loader2, Search, Trash2, UploadCloud, X } from "lucide-react";
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

  const loadAssets = useCallback(async () => {
    if (!workspace) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/media?workspaceId=${workspace.id}`, { cache: "no-store" });
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
  }, [toast, workspace]);

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

  const deleteAsset = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete "${asset.fileName || "this file"}" from the media library?`)) return;
    setDeletingId(asset.id);
    try {
      const response = await fetch(`/api/media/${asset.id}`, { method: "DELETE" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? "Unable to delete media");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (preview?.id === asset.id) setPreview(null);
      toast({ title: "Media deleted" });
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
          <p className="text-text-tertiary text-xs mb-1">{assets.length} assets</p>
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
          <button onClick={() => setShowUpload((current) => !current)} className="btn-primary h-9">
            <UploadCloud className="w-4 h-4" />
            Upload Files
          </button>
        </div>
      </div>

      {showUpload && workspace && (
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
          <button
            onClick={() => setShowUpload(true)}
            className="w-full min-h-[500px] flex flex-col items-center justify-center text-text-tertiary"
          >
            <UploadCloud className="w-8 h-8 mb-3" />
            <span className="text-sm">{query ? "No files match your search." : "Upload your first image or video."}</span>
          </button>
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
                      <button
                        onClick={() => void deleteAsset(asset)}
                        disabled={deletingId === asset.id}
                        aria-label="Delete"
                        className="w-9 h-9 rounded-full bg-danger/80 text-white flex items-center justify-center hover:bg-danger"
                      >
                        {deletingId === asset.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">{asset.fileName || "Untitled file"}</p>
                  <p className="text-[10px] text-text-disabled mt-0.5">
                    {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                    {formatSize(asset.fileSize)}
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
