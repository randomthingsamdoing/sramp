/**
 * Typed wrappers around Tauri `invoke()`. Each function maps to a
 * `#[tauri::command]` in `apps/desktop/src-tauri/src/commands/media.rs`.
 *
 * Tauri 2 maps camelCase keys here to snake_case Rust parameters automatically.
 */

import { invoke } from "@tauri-apps/api/core";

import type { MediaClip, Project, TimelineClip } from "./types";

export async function importClip(sourcePath: string): Promise<MediaClip> {
  return invoke<MediaClip>("import_clip", { sourcePath });
}

export async function importFolder(folder: string): Promise<MediaClip[]> {
  return invoke<MediaClip[]>("import_folder", { folder });
}

export async function listClips(): Promise<MediaClip[]> {
  return invoke<MediaClip[]>("list_clips");
}

export async function getClip(id: string): Promise<MediaClip | null> {
  return invoke<MediaClip | null>("get_clip", { id });
}

export async function removeClip(id: string): Promise<void> {
  await invoke("remove_clip", { id });
}

// ── Timeline (week 3) ─────────────────────────────────────────────

export async function getProject(): Promise<Project> {
  return invoke<Project>("get_project");
}

export async function addClipToTrack(
  trackId: string,
  mediaId: string,
  positionSec: number,
): Promise<TimelineClip> {
  return invoke<TimelineClip>("add_clip_to_track", {
    trackId,
    mediaId,
    positionSec,
  });
}

export async function removeClipFromTrack(
  trackId: string,
  clipId: string,
): Promise<void> {
  await invoke("remove_clip_from_track", { trackId, clipId });
}

export async function setPlayhead(sec: number): Promise<void> {
  await invoke("set_playhead", { sec });
}
