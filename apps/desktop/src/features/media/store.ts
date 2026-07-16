/**
 * Media library state — zustand. Holds imported clips, listens for the
 * Rust-side background events (thumb ready, proxy state transitions), and
 * tracks which clip is selected for preview.
 *
 * Race-condition note: Rust's spawned thumb + proxy tasks can fire their
 * "ready" / "generating" / "ready" events BEFORE the IPC return that hands
 * the clip back to React's store. We buffer per-id events that arrive for
 * an unknown clip and replay them when `addClip` lands. Without this, the
 * first import in a session sees its events delivered before React has the
 * clip to update — and the UI sticks at pending / no thumb.
 */

import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { MediaClip, ProxyInfo } from "@/lib/types";

interface PendingEvents {
  thumb_path?: string;
  proxy?: ProxyInfo;
}

interface MediaState {
  clips: MediaClip[];
  ready: boolean;
  selectedClipId: string | null;
  /** Per-clip-id event buffer for race conditions. */
  pendingEvents: Record<string, PendingEvents>;
  init: () => Promise<void>;
  addClip: (clip: MediaClip) => void;
  addClips: (clips: MediaClip[]) => void;
  updateThumb: (id: string, thumbPath: string) => void;
  updateProxy: (id: string, info: ProxyInfo) => void;
  removeClip: (id: string) => void;
  setSelected: (id: string | null) => void;
}

let unlistenThumb: UnlistenFn | null = null;
let unlistenProxy: UnlistenFn | null = null;

function patchClip(
  clips: MediaClip[],
  id: string,
  patch: (c: MediaClip) => MediaClip,
): MediaClip[] {
  return clips.map((c) => (c.id === id ? patch(c) : c));
}

function clipExists(clips: MediaClip[], id: string): boolean {
  return clips.some((c) => c.id === id);
}

function drainBuffer(
  clips: MediaClip[],
  pending: Record<string, PendingEvents>,
  id: string,
): { clips: MediaClip[]; pending: Record<string, PendingEvents> } {
  const buffered = pending[id];
  if (!buffered) return { clips, pending };

  const remaining = { ...pending };
  delete remaining[id];
  let updated = clips;
  if (buffered.thumb_path !== undefined) {
    updated = patchClip(updated, id, (c) => ({
      ...c,
      thumb_path: buffered.thumb_path ?? null,
    }));
  }
  if (buffered.proxy !== undefined) {
    updated = patchClip(updated, id, (c) => ({
      ...c,
      proxy: buffered.proxy!,
    }));
  }
  return { clips: updated, pending: remaining };
}

export const useMediaStore = create<MediaState>((set, get) => ({
  clips: [],
  ready: false,
  selectedClipId: null,
  pendingEvents: {},
  init: async () => {
    if (unlistenThumb && unlistenProxy) return;

    unlistenThumb = await listen<{ id: string; thumb_path: string }>(
      "clip:thumb_ready",
      (event) => {
        const { id, thumb_path } = event.payload;
        const state = get();
        if (clipExists(state.clips, id)) {
          set((s) => ({
            clips: patchClip(s.clips, id, (c) => ({ ...c, thumb_path })),
          }));
        } else {
          set((s) => ({
            pendingEvents: {
              ...s.pendingEvents,
              [id]: { ...s.pendingEvents[id], thumb_path },
            },
          }));
        }
      },
    );

    unlistenProxy = await listen<{
      id: string;
      status: ProxyInfo["status"];
      path: string | null;
      error: string | null;
    }>("clip:proxy_state", (event) => {
      const { id, status, path, error } = event.payload;
      const newProxy: ProxyInfo = { status, path, error };
      const state = get();
      if (clipExists(state.clips, id)) {
        set((s) => ({
          clips: patchClip(s.clips, id, (c) => ({ ...c, proxy: newProxy })),
        }));
      } else {
        set((s) => ({
          pendingEvents: {
            ...s.pendingEvents,
            [id]: { ...s.pendingEvents[id], proxy: newProxy },
          },
        }));
      }
    });

    set({ ready: true });
  },
  addClip: (clip) =>
    set((s) => {
      const appended = [...s.clips, clip];
      const drained = drainBuffer(appended, s.pendingEvents, clip.id);
      return { clips: drained.clips, pendingEvents: drained.pending };
    }),
  addClips: (clips) =>
    set((s) => {
      const dedup = [...s.clips, ...clips.filter((c) => !s.clips.some((x) => x.id === c.id))];
      let pending = s.pendingEvents;
      let list = dedup;
      for (const c of clips) {
        const drained = drainBuffer(list, pending, c.id);
        list = drained.clips;
        pending = drained.pending;
      }
      return { clips: list, pendingEvents: pending };
    }),
  updateThumb: (id, thumbPath) =>
    set((s) => ({
      clips: patchClip(s.clips, id, (c) => ({ ...c, thumb_path: thumbPath })),
    })),
  updateProxy: (id, info) =>
    set((s) => ({
      clips: patchClip(s.clips, id, (c) => ({ ...c, proxy: info })),
    })),
  removeClip: (id) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),
  setSelected: (id) => set({ selectedClipId: id }),
}));
