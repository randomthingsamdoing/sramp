// Sramp — desktop shell (Rust).
// Plugins + command handlers live in submodules; this file wires them up.

mod commands;
mod media;
mod timeline;

use std::sync::Mutex;

use tokio::sync::Mutex as TokioMutex;

use crate::media::MediaClip;

pub struct AppState {
    pub clips: TokioMutex<Vec<MediaClip>>,
    /// Detected once at startup so per-clip generation doesn't re-probe.
    pub hw_encoder: Mutex<String>,
    /// The per-session editing project (tracks, clips, playhead). Distinct
    /// from `clips` (the media library). Persisted in week 8.
    pub project: TokioMutex<timeline::Project>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hw_encoder = media::proxy::detect_hw_encoder();
    eprintln!("[startup] hw encoder: {hw_encoder}");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            hw_encoder: Mutex::new(hw_encoder),
            clips: TokioMutex::new(Vec::new()),
            project: TokioMutex::new(timeline::empty_project()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::media::import_clip,
            commands::media::import_folder,
            commands::media::list_clips,
            commands::media::remove_clip,
            commands::media::get_clip,
            commands::timeline::get_project,
            commands::timeline::add_clip_to_track,
            commands::timeline::remove_clip_from_track,
            commands::timeline::set_playhead,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
