//! Tauri commands for the timeline project (tracks, clips, playhead).
//! Week 3a scope: get/add/remove/set_playhead. Week 3b adds trim, zoom,
//! multi-track ordering.

use tauri::State;

use crate::timeline::{TimelineClip, Track};
use crate::AppState;

#[tauri::command]
pub async fn get_project(state: State<'_, AppState>) -> Result<crate::timeline::Project, String> {
    Ok(state.project.lock().await.clone())
}

#[tauri::command]
pub async fn add_clip_to_track(
    state: State<'_, AppState>,
    track_id: String,
    media_id: String,
    position_sec: f64,
) -> Result<TimelineClip, String> {
    // Look up the source clip's duration to seed in_sec / out_sec. We hold
    // the media lock just long enough to read — release before locking the
    // project to avoid ordering surprises if a second command runs in
    // parallel.
    let source_duration = {
        let g = state.clips.lock().await;
        g.iter()
            .find(|c| c.id == media_id)
            .and_then(|c| c.probe.as_ref().map(|p| p.duration_sec))
            .unwrap_or(0.0)
    };
    if source_duration <= 0.0 {
        return Err(format!(
            "cannot add clip — no probe duration for media_id={media_id}"
        ));
    }

    let tl_clip = TimelineClip {
        id: uuid::Uuid::new_v4().to_string(),
        media_id,
        position_sec: position_sec.max(0.0),
        in_sec: 0.0,
        out_sec: source_duration,
    };

    let mut proj = state.project.lock().await;
    let track = proj
        .tracks
        .iter_mut()
        .find(|t| t.id == track_id)
        .ok_or_else(|| format!("track not found: {track_id}"))?;
    track.clips.push(tl_clip.clone());

    Ok(tl_clip)
}

#[tauri::command]
pub async fn remove_clip_from_track(
    state: State<'_, AppState>,
    track_id: String,
    clip_id: String,
) -> Result<(), String> {
    let mut proj = state.project.lock().await;
    if let Some(track) = proj.tracks.iter_mut().find(|t| t.id == track_id) {
        track.clips.retain(|c| c.id != clip_id);
    }
    Ok(())
}

/// Update the playhead. The frontend also keeps an optimistic local copy
/// at 60fps during drag; this is the backend commit so a session restart
/// lands near the right place. (Persistence itself is week 8.)
#[tauri::command]
pub async fn set_playhead(
    state: State<'_, AppState>,
    sec: f64,
) -> Result<(), String> {
    let mut p = state.project.lock().await;
    p.playhead_sec = sec.max(0.0);
    Ok(())
}

// Compile-time check that the public surface doesn't drift from a
// stray rename — references the Track type to keep it in scope.
const _: fn() = || {
    let _ = std::marker::PhantomData::<Track>;
};
