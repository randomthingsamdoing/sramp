// Sramp — desktop shell (Rust).
// Plugins + command handlers live in submodules; this file wires them up.

mod commands;
mod media;

use std::sync::Mutex;

use tokio::sync::Mutex as TokioMutex;

use crate::media::MediaClip;

#[derive(Default)]
pub struct AppState {
    pub clips: TokioMutex<Vec<MediaClip>>,
    /// Detected once at startup so per-clip generation doesn't re-probe.
    pub hw_encoder: Mutex<String>,
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
        })
        .invoke_handler(tauri::generate_handler![
            commands::media::import_clip,
            commands::media::import_folder,
            commands::media::list_clips,
            commands::media::remove_clip,
            commands::media::get_clip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
