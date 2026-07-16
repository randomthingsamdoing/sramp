use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::media::{probe, proxy, thumb, MediaClip, ProxyInfo};
use crate::AppState;

const SUPPORTED_EXTS: &[&str] = &["mp4", "mov", "m4v", "mkv"];

#[derive(Serialize, Clone)]
struct ThumbReady {
    id: String,
    thumb_path: String,
}

#[derive(Serialize, Clone)]
struct ProxyStateEvent {
    id: String,
    status: String,
    path: Option<String>,
    error: Option<String>,
}

/// Import a single clip. Probes synchronously (fast), kicks thumb + proxy
/// extraction in the background, returns the clip with `thumb_path = None`
/// and a placeholder proxy status. The frontend gets `clip:thumb_ready` and
/// `clip:proxy_state` events when each background job transitions.
#[tauri::command]
pub async fn import_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    source_path: String,
) -> Result<MediaClip, String> {
    let path = Path::new(&source_path);
    if !path.exists() {
        return Err(format!("File not found: {source_path}"));
    }
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("clip")
        .to_string();
    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let probe_info = probe::probe(&source_path).ok();
    let has_video = probe_info
        .as_ref()
        .map(|p| p.width > 0 && p.height > 0)
        .unwrap_or(false);

    // Initial proxy status:
    //   - source >720p → "pending" (worker will generate)
    //   - source ≤720p or audio-only / probe-failed → "source" (no proxy needed)
    let proxy_info = if proxy::needs_proxy(probe_info.as_ref()) {
        ProxyInfo::pending()
    } else {
        ProxyInfo::source()
    };

    let clip = MediaClip {
        id: uuid::Uuid::new_v4().to_string(),
        source_path: source_path.clone(),
        name,
        size_bytes,
        imported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        probe: probe_info,
        thumb_path: None,
        proxy: proxy_info,
    };

    // Kick off thumb extraction only when the file actually has a video
    // stream — otherwise ffmpeg's image2 muxer errors with "Output file
    // does not contain any stream" and we leak that into a silent failure.
    if has_video {
        let app = app.clone();
        let id = clip.id.clone();
        let path = clip.source_path.clone();
        eprintln!("[thumb] spawn for {path} (id={id})");
        tokio::spawn(async move {
            let cache_root = match app.path().app_cache_dir() {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("[thumb] app_cache_dir failed for {path}: {e}");
                    return;
                }
            };
            match thumb::generate(&cache_root, &path).await {
                Ok(p) => {
                    let thumb_path = p.to_string_lossy().to_string();
                    eprintln!("[thumb] ok id={id} -> {thumb_path}");
                    match app.emit(
                        "clip:thumb_ready",
                        ThumbReady {
                            id: id.clone(),
                            thumb_path: thumb_path.clone(),
                        },
                    ) {
                        Ok(()) => {}
                        Err(e) => eprintln!("[thumb] emit failed for {id}: {e}"),
                    }
                }
                Err(e) => {
                    eprintln!("[thumb] failed for {path}: {e:#}");
                }
            }
        });
    }

    // Kick off proxy generation only when the source actually needs one.
    let needs_proxy = clip.proxy.status == "pending";
    if needs_proxy {
        let app = app.clone();
        let id = clip.id.clone();
        let path = clip.source_path.clone();
        eprintln!("[proxy] spawn for {path} (id={id})");
        // Resolve encoder once, before the spawn — avoids the State guard
        // having to outlive the inner expression.
        let hw_encoder = state.hw_encoder.lock().unwrap().clone();
        tokio::spawn(async move {
            // Flip to "generating"
            if let Err(e) = app.emit(
                "clip:proxy_state",
                ProxyStateEvent {
                    id: id.clone(),
                    status: "generating".into(),
                    path: None,
                    error: None,
                },
            ) {
                eprintln!("[proxy] emit 'generating' failed for {id}: {e}");
            }

            let cache_root = match app.path().app_cache_dir() {
                Ok(p) => p,
                Err(e) => {
                    let msg = format!("cache dir: {e}");
                    eprintln!("[proxy] app_cache_dir failed for {path}: {e}");
                    let _ = app.emit(
                        "clip:proxy_state",
                        ProxyStateEvent {
                            id: id.clone(),
                            status: "failed".into(),
                            path: None,
                            error: Some(msg),
                        },
                    );
                    return;
                }
            };

            match proxy::generate(&cache_root, &path, &hw_encoder).await {
                Ok(out) => {
                    eprintln!(
                        "[proxy] ok id={id} status={} path={:?}",
                        out.status, out.path
                    );
                    if let Err(e) = app.emit(
                        "clip:proxy_state",
                        ProxyStateEvent {
                            id: id.clone(),
                            status: out.status,
                            path: out.path,
                            error: None,
                        },
                    ) {
                        eprintln!("[proxy] emit 'final' failed for {id}: {e}");
                    }
                }
                Err(e) => {
                    let msg = format!("{e:#}");
                    eprintln!("[proxy] failed for {path}: {msg}");
                    let _ = app.emit(
                        "clip:proxy_state",
                        ProxyStateEvent {
                            id: id.clone(),
                            status: "failed".into(),
                            path: None,
                            error: Some(msg),
                        },
                    );
                }
            }
        });
    }

    state.clips.lock().await.push(clip.clone());
    Ok(clip)
}

/// Import every supported video file at the top level of `folder` (no
/// recursion in week 2 — keeps it deterministic).
#[tauri::command]
pub async fn import_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    folder: String,
) -> Result<Vec<MediaClip>, String> {
    let mut out: Vec<MediaClip> = Vec::new();
    for entry in walkdir::WalkDir::new(&folder)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !is_supported_video(path) {
            continue;
        }
        let source_path = path.to_string_lossy().to_string();
        match import_clip(app.clone(), state.clone(), source_path.clone()).await {
            Ok(c) => out.push(c),
            Err(e) => eprintln!("import_clip failed for {source_path}: {e}"),
        }
    }
    Ok(out)
}

/// Read-only access to the current clip list (for debugging / future use).
#[tauri::command]
pub async fn list_clips(state: State<'_, AppState>) -> Result<Vec<MediaClip>, String> {
    Ok(state.clips.lock().await.clone())
}

/// Read-only access to a single clip by id. Used by the preview pane —
/// keeps the wire payload small vs. shipping the whole list.
#[tauri::command]
pub async fn get_clip(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<MediaClip>, String> {
    let g = state.clips.lock().await;
    Ok(g.iter().find(|c| c.id == id).cloned())
}

/// Remove a clip from the in-memory store. Does NOT delete the source file.
#[tauri::command]
pub async fn remove_clip(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut g = state.clips.lock().await;
    g.retain(|c| c.id != id);
    Ok(())
}

fn is_supported_video(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some(ext) if SUPPORTED_EXTS.contains(&ext)
    )
}
