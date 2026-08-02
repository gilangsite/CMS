"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface RealWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface RealBrand {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface BrandContextValue {
  workspace: RealWorkspace | null;
  brands: RealBrand[];
  activeBrand: RealBrand | null;
  setActiveBrandId: (id: string) => void;
  loading: boolean;
  refetchBrands: () => void;
}

const BrandContext = createContext<BrandContextValue | null>(null);

const BRAND_PALETTE = [
  "linear-gradient(135deg,#5b8def,#3f6fd8)",
  "linear-gradient(135deg,#6FC6FF,#3E7FD8)",
  "linear-gradient(135deg,#5B8DF0,#3E63D8)",
  "linear-gradient(135deg,#7FA6FF,#5B8DF0)",
  "linear-gradient(135deg,#A9C4F5,#7FA6FF)",
];

function colorForBrand(id: string): string {
  const sum = Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BRAND_PALETTE[sum % BRAND_PALETTE.length];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as T) : null;
  } catch {
    return null;
  }
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<RealWorkspace | null>(null);
  const [brands, setBrands] = useState<RealBrand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetchToken, setRefetchToken] = useState(0);

  const refetchBrands = useCallback(() => setRefetchToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const workspaces = await fetchJson<{ id: string; name: string; slug: string }[]>("/api/workspaces");
      const ws = workspaces?.[0] ?? null;
      if (cancelled) return;
      setWorkspace(ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null);

      if (ws) {
        const rawBrands = await fetchJson<{ id: string; name: string; description: string | null }[]>(
          `/api/brands?workspaceId=${ws.id}`
        );
        if (cancelled) return;
        const list = (rawBrands ?? []).map((b) => ({ ...b, color: colorForBrand(b.id) }));
        setBrands(list);
        setActiveBrandId((prev) => (prev && list.some((b) => b.id === prev) ? prev : list[0]?.id ?? null));
      } else {
        setBrands([]);
        setActiveBrandId(null);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null;

  return (
    <BrandContext.Provider value={{ workspace, brands, activeBrand, setActiveBrandId, loading, refetchBrands }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within a BrandProvider");
  return ctx;
}
