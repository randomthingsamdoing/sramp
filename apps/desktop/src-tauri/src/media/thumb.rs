use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};

/// Width of the cached thumbnail — enough to scan in a 2-col tile, cheap to
/// keep on disk. Aspect preserved via `scale=320:-2`.
const THUMB_WIDTH: u32 = 320;

/// Extract a single-frame JPEG thumbnail for `source_path` and cache it under
/// `cache_root/thumbs/<hash>.jpg`. Subsequent calls with the same fingerprint
/// return the cached path without re-running ffmpeg.
///
/// Returns the absolute path to the thumbnail.
pub async fn generate(cache_root: &Path, source_path: &str) -> Result<PathBuf> {
    let cache_dir = cache_root.join("thumbs");
    std::fs::create_dir_all(&cache_dir)
        .with_context(|| format!("create thumb cache dir at {}", cache_dir.display()))?;

    let hash = fingerprint(source_path).with_context(|| format!("fingerprint {source_path}"))?;
    let thumb = cache_dir.join(format!("{hash}.jpg"));

    if thumb.exists() {
        return Ok(thumb);
    }

    let source = source_path.to_string();
    let thumb_str = thumb.to_string_lossy().to_string();

    // Run ffmpeg synchronously inside a tokio::task::spawn so the
    // blocking subprocess doesn't occupy the runtime worker. Capture
    // stderr explicitly — every failure mode gets captured.
    let source_for_task = source.clone();
    let thumb_for_task = thumb_str.clone();
    let join = tokio::task::spawn_blocking(move || -> Result<()> {
        let output = std::process::Command::new("ffmpeg")
            .args([
                "-y",
                "-ss",
                "1.0",
                "-i",
                &source_for_task,
                "-frames:v",
                "1",
                "-vf",
                &format!("scale={THUMB_WIDTH}:-2"),
                "-q:v",
                "5",
                "-update",
                "1",
                "-f",
                "image2",
                &thumb_for_task,
            ])
            .output()
            .with_context(|| format!("spawn ffmpeg for {source_for_task}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!(
                "ffmpeg thumb failed: exit={:?}, stderr-truncated={}",
                output.status.code(),
                tail(&stderr, 800)
            );
        }
        Ok(())
    });

    match join.await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return Err(e),
        Err(join_err) => {
            return Err(anyhow::anyhow!("thumb task panicked: {join_err}"));
        }
    }

    Ok(thumb)
}

/// Stable-enough fingerprint for cache key. Uses path + size + mtime (NOT
/// content-addressable by stream). Week 4 polish can swap to a real content
/// hash if collisions bite; for week 2 this is fast and avoids a full file
/// read per import.
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
        // Try to land on a line boundary
        let start = s[start..]
            .find('\n')
            .map(|i| start + i + 1)
            .unwrap_or(start);
        format!("…{}", &s[start..])
    }
}
