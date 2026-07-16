//! 720p proxy generation. Audio-stripped (original audio plays from the
//! timeline in week 3+), BT.709 color tag, hardware encode when present.
//!
//! See `PLAN.md` §11 for the design rationale.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};

const PROXY_HEIGHT: u32 = 720;
/// Target bitrate for the 720p proxy (5 Mbps is plenty for SDR preview
/// material that we will discard after export).
const PROXY_BITRATE: &str = "5M";

/// Proxy generation outcome. The "source" status means the original file
/// IS the proxy (it was ≤720p on import, so we skip encoding).
#[derive(Debug, Clone, Serialize)]
pub struct ProxyResult {
    pub status: String,
    pub path: Option<String>,
}

/// Detect the best available H.264 hardware encoder on the host. Falls
/// back to `libx264` (always present with a system ffmpeg).
pub fn detect_hw_encoder() -> String {
    let output = Command::new("ffmpeg")
        .args(["-hide_banner", "-encoders"])
        .output();
    if let Ok(out) = output {
        let s = String::from_utf8_lossy(&out.stdout);
        if s.contains("h264_videotoolbox") {
            return "h264_videotoolbox".into();
        }
        if s.contains("h264_nvenc") {
            return "h264_nvenc".into();
        }
        if s.contains("h264_qsv") {
            return "h264_qsv".into();
        }
    }
    "libx264".into()
}

/// Decide whether a clip actually needs a proxy. Returns false for ≤720p
/// sources (the original IS the proxy), for audio-only sources (no video
/// stream to encode), and for probes that failed.
pub fn needs_proxy(probe: Option<&super::ProbeInfo>) -> bool {
    match probe {
        Some(p) => p.height > 720 && p.width > 0,
        None => false,
    }
}

/// Generate the proxy. Runs ffmpeg synchronously on a blocking-aware thread
/// because ffmpeg is a CPU-bound subprocess.
pub async fn generate(
    cache_root: &Path,
    source_path: &str,
    hw_encoder: &str,
) -> Result<ProxyResult> {
    let cache_dir = cache_root.join("proxies");
    std::fs::create_dir_all(&cache_dir)
        .with_context(|| format!("create proxy cache dir at {}", cache_dir.display()))?;

    let hash = fingerprint(source_path)
        .with_context(|| format!("fingerprint {source_path}"))?;
    let proxy = cache_dir.join(format!("{hash}.mp4"));

    if proxy.exists() {
        return Ok(ProxyResult {
            status: "ready".into(),
            path: Some(proxy.to_string_lossy().to_string()),
        });
    }

    let source = source_path.to_string();
    let proxy_str: String = proxy.to_string_lossy().to_string();
    let encoder = hw_encoder.to_string();
    // Capture the proxy path for the return value before it gets moved into
    // the spawn_blocking closure.
    let result_path = proxy_str.clone();

    let join = tokio::task::spawn_blocking(move || -> Result<()> {
        let output = Command::new("ffmpeg")
            .args([
                "-y",
                "-i",
                &source,
                "-vf",
                &format!("scale=-2:{PROXY_HEIGHT}"),
                "-c:v",
                &encoder,
                "-b:v",
                PROXY_BITRATE,
                "-an",
                // Explicit BT.709 tagging — see PLAN.md §11 Color management.
                // Without these, h264_videotoolbox may carry forward source
                // tags, and libx264 may emit BT.601, both of which downstream
                // players (IG/TikTok) then re-interpret as desaturated.
                "-color_primaries", "bt709",
                "-color_trc", "bt709",
                "-colorspace", "bt709",
                "-color_range", "tv",
                "-movflags", "+faststart",
                &proxy_str,
            ])
            .output()
            .with_context(|| format!("spawn ffmpeg for {source}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!(
                "proxy ffmpeg failed: exit={:?}, stderr={}",
                output.status.code(),
                tail(&stderr, 800)
            );
        }
        Ok(())
    });

    match join.await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return Err(e),
        Err(join_err) => return Err(anyhow!("proxy task panicked: {join_err}")),
    }

    Ok(ProxyResult {
        status: "ready".into(),
        path: Some(result_path),
    })
}

fn fingerprint(path: &str) -> Result<String> {
    let meta = std::fs::metadata(path)
        .with_context(|| format!("stat {path}"))?;
    let mtime_secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut h = Sha256::new();
    h.update(path.as_bytes());
    h.update(&meta.len().to_le_bytes());
    h.update(&mtime_secs.to_le_bytes());
    let full = hex::encode(h.finalize());
    Ok(full[..16].to_string())
}

fn tail(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        s.to_string()
    } else {
        let start = s.len() - max_bytes;
        let start = s[start..]
            .find('\n')
            .map(|i| start + i + 1)
            .unwrap_or(start);
        format!("…{}", &s[start..])
    }
}

/// Helper: read file size, useful for UI progress polling later.
#[allow(dead_code)]
pub async fn file_size(path: &Path) -> Result<u64> {
    Ok(tokio::fs::metadata(path).await?.len())
}

/// Helper: where proxy files live, given a cache root.
#[allow(dead_code)]
pub fn proxy_dir(cache_root: &Path) -> PathBuf {
    cache_root.join("proxies")
}
