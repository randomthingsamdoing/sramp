pub mod probe;
pub mod proxy;
pub mod thumb;

use serde::{Deserialize, Serialize};

/// A clip imported into the Sramp library. Source of truth lives in
/// `AppState::clips` (in-memory; persisted as part of the project file in
/// week 8).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaClip {
    pub id: String,
    pub source_path: String,
    pub name: String,
    pub size_bytes: u64,
    pub imported_at: u64,
    pub probe: Option<ProbeInfo>,
    /// `None` until the background thumb worker finishes writing it.
    pub thumb_path: Option<String>,
    pub proxy: ProxyInfo,
}

/// ProbeInfo is what ffprobe returns — formatted for the UI to render.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeInfo {
    pub duration_sec: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub video_codec: String,
    pub audio_codec: Option<String>,
    pub container: String,
    pub color_primaries: Option<String>,
    pub color_transfer: Option<String>,
    pub color_space: Option<String>,
    /// True if the source carries HDR metadata (PQ or HLG transfer). We
    /// surface a badge but export SDR BT.709 in v1.
    pub is_hdr: bool,
}

/// ProxyInfo tracks the 720p preview proxy for the clip.
///   `status`:  "pending" | "generating" | "ready" | "source" | "failed"
///   `path`:    absolute path when `status == "ready"`
///   `error`:   last error message when `status == "failed"`
///
/// For sources ≤720p, status is "source" (no proxy generated; the
/// original IS the proxy).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyInfo {
    pub status: String,
    pub path: Option<String>,
    pub error: Option<String>,
}

impl ProxyInfo {
    pub fn source() -> Self {
        Self {
            status: "source".into(),
            path: None,
            error: None,
        }
    }
    pub fn pending() -> Self {
        Self {
            status: "pending".into(),
            path: None,
            error: None,
        }
    }
}
