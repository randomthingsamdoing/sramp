/**
 * Timeline store — zustand. Owns the `Project` (tracks + playhead + zoom)
 * for the current editing session. The Rust side holds the canonical state;
 * this store mirrors it and applies optimistic mutations.
 *
 * Init is guarded against React StrictMode double-mount (same pattern as the
 * media store).
 */

import { create } from "zustand";

import {
  addClipToTrack as addClipToTrackBackend,
  getProject,
  removeClipFromTrack as removeClipFromTrackBackend,
  setPlayhead as setPlayheadBackend,
} from "@/lib/ipc";
import type { Project, TimelineClip } from "@/lib/types";

interface DragGhost {
  mediaId: string;
  mediaName: string;
}

interface TimelineState {
  project: Project;
  dragging: DragGhost | null;
  /** Local-only playhead-dragging flag for global pointermove routing. */
  playheadDragging: boolean;

  init: () => Promise<void>;

  addClipToTrack: (
    trackId: string,
    mediaId: string,
    positionSec: number,
  ) => Promise<void>;
  removeClipFromTrack: (trackId: string, clipId: string) => Promise<void>;

  /** Local + backend. Backend call is throttled to ~30 Hz during drag. */
  setPlayhead: (sec: number) => void;

  setDragging: (g: DragGhost | null) => void;
  setPlayheadDragging: (b: boolean) => void;

  getVideoTracks: () => { id: string }[];
  /** Returns the timeline clip (and its track id) at the playhead, or null. */
  getActiveTimelineClip: () => { trackId: string; clip: TimelineClip } | null;
}

let initialized = false;
let lastPlayheadBackendSentMs = 0;
const PLAYHEAD_BACKEND_THROTTLE_MS = 33;

export const useTimelineStore = create<TimelineState>((set, get) => ({
  project: { tracks: [], playhead_sec: 0, zoom: 50 },
  dragging: null,
  playheadDragging: false,

  init: async () => {
    if (initialized) return;
    initialized = true;
    try {
      const project = await getProject();
      set({ project });
    } catch (e) {
      console.error("[timeline.init] failed", e);
    }
  },

  addClipToTrack: async (trackId, mediaId, positionSec) => {
    try {
      const clip = await addClipToTrackBackend(trackId, mediaId, positionSec);
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        },
      }));
    } catch (e) {
      console.error("[timeline.addClipToTrack] failed", e);
    }
  },

  removeClipFromTrack: async (trackId, clipId) => {
    try {
      await removeClipFromTrackBackend(trackId, clipId);
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
              : t,
          ),
        },
      }));
    } catch (e) {
      console.error("[timeline.removeClipFromTrack] failed", e);
    }
  },

  setPlayhead: (sec) => {
    const clamped = Math.max(0, sec);
    set((s) => ({
      project: { ...s.project, playhead_sec: clamped },
    }));
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastPlayheadBackendSentMs > PLAYHEAD_BACKEND_THROTTLE_MS) {
      lastPlayheadBackendSentMs = now;
      void setPlayheadBackend(clamped);
    }
  },

  setDragging: (g) => set({ dragging: g }),
  setPlayheadDragging: (b) => set({ playheadDragging: b }),

  getVideoTracks: () =>
    get()
      .project.tracks.filter((t) => t.kind === "video")
      .map((t) => ({ id: t.id })),

  getActiveTimelineClip: () => {
    const s = get();
    const ph = s.project.playhead_sec;
    for (const track of s.project.tracks) {
      if (track.kind !== "video") continue;
      for (const clip of track.clips) {
        const dur = clip.out_sec - clip.in_sec;
        if (ph >= clip.position_sec && ph < clip.position_sec + dur) {
          return { trackId: track.id, clip };
        }
      }
    }
    return null;
  },
}));
