"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { 
  FileImage, 
  Layers, 
  Calendar, 
  Plus, 
  CheckSquare, 
  Settings, 
  Share2 
} from "lucide-react";
import { useCommandPaletteOpen, toggleCommandPalette, closeCommandPalette } from "@/lib/palette-store";

export function CommandPalette() {
  const open = useCommandPaletteOpen();
  const setOpen = (v: boolean) => (v ? toggleCommandPalette() : closeCommandPalette());
  const router = useRouter();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4 backdrop-blur-sm bg-black/40 animate-fade-in" onClick={() => setOpen(false)}>
      <Command 
        className="w-full max-w-[600px] rounded-xl border border-border-default surface-floating shadow-floating overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <div className="flex items-center border-b border-border-subtle px-4">
          <Command.Input 
            autoFocus 
            placeholder="Type a command or search..." 
            className="w-full h-14 bg-transparent outline-none text-text-primary placeholder:text-text-disabled text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-hover text-[10px] font-medium text-text-secondary border border-border-default">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-none">
          <Command.Empty className="py-6 text-center text-sm text-text-secondary">
            No results found.
          </Command.Empty>

          <Command.Group heading="Content Operations" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary">
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/content/new"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <Plus className="w-4 h-4 text-text-disabled" />
              <span>Create new content</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/media"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <Layers className="w-4 h-4 text-text-disabled" />
              <span>Upload media</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/content"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <FileImage className="w-4 h-4 text-text-disabled" />
              <span>Search content</span>
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-border-subtle my-2" />

          <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary">
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/calendar"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <Calendar className="w-4 h-4 text-text-disabled" />
              <span>Open calendar</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/approvals"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <CheckSquare className="w-4 h-4 text-text-disabled" />
              <span>Open approval queue</span>
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-border-subtle my-2" />

          <Command.Group heading="Settings" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary">
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/settings"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <Settings className="w-4 h-4 text-text-disabled" />
              <span>Workspace settings</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/app/social-accounts"))}
              className="flex items-center gap-2 px-2 py-2.5 text-sm text-text-secondary rounded-md cursor-pointer aria-selected:bg-surface-hover aria-selected:text-text-primary transition-colors"
            >
              <Share2 className="w-4 h-4 text-text-disabled" />
              <span>Connect social account</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
