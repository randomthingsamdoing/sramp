/**
 * Mirror of the Rust types in `apps/desktop/src-tauri/src/media/mod.rs`.
 * Keep these in sync — the IPC contract is the source of truth on both sides.
 */

export interface ProbeInfo {
  duration_sec: number;
  width: number;
  height: number;
  fps: number;
  video_codec: string;
  audio_codec: string | null;
  container: string;
  color_primaries: string | null;
  color_transfer: string | null;
  color_space: string | null;
  /** True if source carries HDR metadata (PQ/HLG transfer). */
  is_hdr: boolean;
}

export type ProxyStatus =
  | "pending"
  | "generating"
  | "ready"
  | "source"
  | "failed";

export interface ProxyInfo {
  status: ProxyStatus;
  /** Absolute path when status === "ready". */
  path: string | null;
  /** Last ffmpeg error message when status === "failed". */
  error: string | null;
}

export interface MediaClip {
  id: string;
  source_path: string;
  name: string;
  size_bytes: number;
  /** Unix epoch seconds, set at import time. */
  imported_at: number;
  probe: ProbeInfo | null;
  /** Becomes non-null once the Rust thumb worker finishes and emits the event. */
  thumb_path: string | null;
  proxy: ProxyInfo;
}
