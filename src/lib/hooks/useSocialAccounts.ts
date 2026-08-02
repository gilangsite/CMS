"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/lib/brand-context";

export interface RealSocialAccount {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK";
  platformAccountId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accountType: string | null;
  scopes: string[];
  status: "CONNECTED" | "EXPIRED" | "DISCONNECTED" | "ERROR";
  lastSyncedAt: string | null;
  createdAt: string;
  brandId: string | null;
  brand: { id: string; name: string } | null;
}

export function useSocialAccounts() {
  const { workspace } = useBrand();
  const [accounts, setAccounts] = useState<RealSocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetchToken, setRefetchToken] = useState(0);

  const refetch = useCallback(() => setRefetchToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!workspace) {
        if (!cancelled) {
          setAccounts([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/social/accounts?workspaceId=${workspace.id}`);
        const json = await res.json();
        if (!cancelled && json.success) setAccounts(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace, refetchToken]);

  return { accounts, loading, refetch };
}
