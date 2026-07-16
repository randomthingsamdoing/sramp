use anyhow::{Context, Result};
use serde_json::Value;

use super::ProbeInfo;

/// Run ffprobe on a media file and extract a normalized ProbeInfo.
/// `path` is the absolute path to the source clip.
pub fn probe(path: &str) -> Result<ProbeInfo> {
    let output = std::process::Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .with_context(|| format!("ffprobe invocation failed for {path}"))?;

    if !output.status.success() {
        anyhow::bail!(
            "ffprobe non-zero exit for {path}: stderr={}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let v: Value = serde_json::from_slice(&output.stdout).context("ffprobe json parse")?;
    parse(v)
}

fn parse(v: Value) -> Result<ProbeInfo> {
    let streams = v["streams"].as_array().cloned().unwrap_or_default();
    let format = &v["format"];

    let video = streams.iter().find(|s| s["codec_type"] == "video");
    let audio = streams.iter().find(|s| s["codec_type"] == "audio");

    let (width, height, fps, vcodec) = video
        .map(|v| {
            (
                v["width"].as_u64().unwrap_or(0) as u32,
                v["height"].as_u64().unwrap_or(0) as u32,
                parse_fps(v["r_frame_rate"].as_str().unwrap_or("0/1")),
                v["codec_name"].as_str().unwrap_or("unknown").to_string(),
            )
        })
        .unwrap_or((0, 0, 0.0, "none".into()));

    let acodec = audio.and_then(|a| a["codec_name"].as_str().map(str::to_string));
    let container = format["format_name"].as_str().unwrap_or("unknown").to_string();
    let duration_sec = format["duration"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);

    let color_primaries = video.and_then(|v| v["color_primaries"].as_str().map(str::to_string));
    let color_transfer = video.and_then(|v| v["color_transfer"].as_str().map(str::to_string));
    let color_space = video.and_then(|v| v["color_space"].as_str().map(str::to_string));

    let is_hdr = matches!(
        color_transfer.as_deref(),
        Some("smpte2084") | Some("arib-std-b67")
    );

    Ok(ProbeInfo {
        duration_sec,
        width,
        height,
        fps,
        video_codec: vcodec,
        audio_codec: acodec,
        container,
        color_primaries,
        color_transfer,
        color_space,
        is_hdr,
    })
}

fn parse_fps(rate: &str) -> f64 {
    rate
        .split_once('/')
        .and_then(|(n, d)| {
            let n: f64 = n.parse().ok()?;
            let d: f64 = d.parse().ok()?;
            if d == 0.0 {
                None
            } else {
                Some(n / d)
            }
        })
        .unwrap_or(0.0)
}
