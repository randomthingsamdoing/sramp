import { FilmIcon, MusicIcon } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { MediaClip } from "@/lib/types";

/**
 * Click-to-play preview. v1 uses native <video controls>; week 3 (timeline)
 * replaces native controls with a custom transport bar synced to the timeline.
 *
 * Plays the SOURCE file directly: proxy is generated in the background for
 * week 3+ timeline work, but click-to-play wants audio included so we keep it
 * simple for now.
 */
export function Preview({ clip }: { clip: MediaClip }) {
  const hasVideo = (clip.probe?.width ?? 0) > 0 && (clip.probe?.height ?? 0) > 0;
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!hasVideo) return;
    const url = convertFileSrc(clip.source_path);
    console.log("[preview] video URL:", url);
    setVideoUrl(url);
    setError("");
  }, [clip.id, clip.source_path, hasVideo]);

  if (!hasVideo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-foreground-muted">
        <MusicIcon className="size-12" strokeWidth={1.25} />
        <div>
          <p className="text-sm font-medium text-foreground">Audio-only source</p>
          <p className="mt-1 text-xs text-foreground-muted/70">
            No video stream to preview. Add to the timeline to use as B-roll audio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <video
        key={clip.id}
        src={videoUrl}
        controls
        autoPlay
        className="max-h-full max-w-full"
        title={clip.name}
        onError={(e) => {
          const el = e.currentTarget;
          const msg = el.error
            ? `code=${el.error.code}, message=${el.error.message ?? ""}`
            : "unknown";
          console.error("[preview] video error:", msg, "src=", videoUrl);
          setError(msg);
        }}
      >
        <track kind="captions" />
      </video>
      {error && (
        <p className="text-xs text-red-300">video error: {error}</p>
      )}
    </div>
  );
}

export function PreviewEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-foreground-muted">
      <FilmIcon className="size-12" strokeWidth={1.25} />
      <div>
        <p className="text-sm font-medium text-foreground">No clip selected</p>
        <p className="mt-1 text-xs text-foreground-muted/70">
          Pick one from the media library to preview here.
        </p>
      </div>
    </div>
  );
}