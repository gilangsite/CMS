"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Toaster } from "@/components/ui/Toaster";
import { BrandProvider } from "@/lib/brand-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <BrandProvider>
      <div className="flex h-screen overflow-hidden bg-background-base text-text-primary">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Topbar />

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1360px] px-[30px] pt-[26px] pb-[60px] animate-fade-in">
              {children}
            </div>
          </main>
        </div>

        <CommandPalette />
        <Toaster />
      </div>
    </BrandProvider>
  );
}
