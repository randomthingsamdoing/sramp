/**
 * Typed wrappers around Tauri `invoke()`. Each function maps to a
 * `#[tauri::command]` in `apps/desktop/src-tauri/src/commands/media.rs`.
 *
 * Tauri 2 maps camelCase keys here to snake_case Rust parameters automatically.
 */

import { invoke } from "@tauri-apps/api/core";

import type { MediaClip } from "./types";

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
