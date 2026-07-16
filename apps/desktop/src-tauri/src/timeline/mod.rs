//! Timeline project model — the per-session editing project, distinct from
//! the `MediaClip` library. A Project has tracks; tracks hold TimelineClips
//! positioned on a time axis. The same MediaClip can appear on multiple
//! tracks, with different trim windows each time.
//!
//! See `PLAN.md` §8 for the data-model plan and `PLAN.md` §15 for the
//! week-3 milestone. Project persistence (.sramp files) lands in week 8.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub tracks: Vec<Track>,
    pub playhead_sec: f64,
    /// Pixels per second — fixed for week 3a. Becomes dynamic in week 3b
    /// (custom-zoom with ctrl-scroll).
    pub zoom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub kind: TrackKind,
    pub clips: Vec<TimelineClip>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Video,
    Audio,
    Music,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineClip {
    pub id: String,
    /// FK into the `MediaClip` library.
    pub media_id: String,
    /// Position on the track timeline (seconds since timeline origin).
    pub position_sec: f64,
    /// Source-side trim in-point (seconds into the source file).
    pub in_sec: f64,
    /// Source-side trim out-point. `out_sec > in_sec` always.
    pub out_sec: f64,
}

impl TimelineClip {
    pub fn duration(&self) -> f64 {
        self.out_sec - self.in_sec
    }
}

/// Construct a fresh project with one empty video track, no clips,
/// playhead at 0. The track id is generated now so the frontend can
/// reference it on first drop without a roundtrip.
pub fn empty_project() -> Project {
    Project {
        tracks: vec![Track {
            id: Uuid::new_v4().to_string(),
            kind: TrackKind::Video,
            clips: Vec::new(),
        }],
        playhead_sec: 0.0,
        zoom: 50.0,
    }
}
