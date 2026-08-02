"use client";

import * as React from "react";

let state = { open: false };
const listeners: Array<(state: { open: boolean }) => void> = [];

function setState(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function openCommandPalette() {
  setState({ open: true });
}

export function closeCommandPalette() {
  setState({ open: false });
}

export function toggleCommandPalette() {
  setState({ open: !state.open });
}

export function useCommandPaletteOpen() {
  const [local, setLocal] = React.useState(state);

  React.useEffect(() => {
    listeners.push(setLocal);
    return () => {
      const i = listeners.indexOf(setLocal);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  return local.open;
}
