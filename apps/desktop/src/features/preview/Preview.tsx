import { useEffect, useRef } from "react";
import { FilmIcon, MusicIcon } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";

import { useMediaStore } from "@/features/media/store";
import { useTimelineStore } from "@/features/timeline/store";

/**
 * Week 3a — preview reads from the timeline. The active clip is the one
 * on the video track that contains the playhead.
 *
 * The video plays the source file with `autoPlay` (same pattern as
 * week 2). The playhead drives the video's currentTime — but we only
 * seek AFTER the browser fires its first `play`/`playing` event, by
 * which point the asset protocol has at least buffered enough for
 * playback. Seeking earlier (on `loadeddata`) caused the browser to
 * enter `waiting` because the buffer for the seek target didn't exist
 * yet.
 */
export function Preview() {
  const active = useTimelineStore(
    useShallow((s) => s.getActiveTimelineClip()),
  );
  const playheadSec = useTimelineStore((s) => s.project.playhead_sec);
  const mediaClip = useMediaStore((s) =>
    active
      ? s.clips.find((c) => c.id === active.clip.media_id) ?? null
      : null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const readyRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);

  const activeId = active?.clip.id ?? null;
  const mediaId = mediaClip?.id ?? null;

  // Apply seek on playhead / active-clip changes. If the browser isn't
  // ready yet (no first play), queue the target — it gets applied
  // when `playing` fires for the first time.
  //
  // The 100ms guard at the bottom is the loop-breaker: every time the
  // video's `timeupdate` fires we write playheadSec, which would re-run
  // this effect and set currentTime back to the same value (or worse,
  // cause a re-seek loop). The guard compares currentTime to the target
  // and skips when they're within 100ms — small enough that any actual
  // user-driven scrub is still applied, but large enough to absorb the
  // natural jitter of timeupdate-driven feedback.
  useEffect(() => {
    if (!active || !mediaClip) return;
    const target = active.clip.in_sec + (playheadSec - active.clip.position_sec);
    if (target < 0 || !Number.isFinite(target)) return;
    if (readyRef.current && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - target) < 0.1) return;
      try {
        videoRef.current.currentTime = target;
      } catch {
        /* may throw if metadata not ready */
      }
    } else {
      pendingSeekRef.current = target;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadSec, activeId, mediaId]);

  // Reset ready state when the source changes (new clip mounted).
  useEffect(() => {
    readyRef.current = false;
    pendingSeekRef.current = null;
  }, [mediaId]);

  if (!mediaClip) {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-foreground-muted">
        <FilmIcon className="size-12" strokeWidth={1.25} />
        <div>
          <p className="text-sm font-medium text-foreground">No clip on the playhead</p>
          <p className="mt-1 text-xs text-foreground-muted/70">
            Drag a clip from the library onto the timeline to begin.
          </p>
        </div>
      </div>
    );
  }

  const hasVideo =
    (mediaClip.probe?.width ?? 0) > 0 && (mediaClip.probe?.height ?? 0) > 0;

  if (!hasVideo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-foreground-muted">
        <MusicIcon className="size-12" strokeWidth={1.25} />
        <div>
          <p className="text-sm font-medium text-foreground">Audio-only source</p>
          <p className="mt-1 text-xs text-foreground-muted/70">
            No video stream — use as B-roll audio on a future audio track.
          </p>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={mediaClip.id}
      src={convertFileSrc(mediaClip.source_path)}
      controls
      autoPlay
      className="max-h-full max-w-full"
      title={mediaClip.name}
      onPlaying={() => {
        // First time we see a real frame rendering, mark ready and apply
        // any pending seek. Subsequent playings just re-apply if a seek
        // is queued.
        readyRef.current = true;
        if (pendingSeekRef.current !== null && videoRef.current) {
          try {
            videoRef.current.currentTime = pendingSeekRef.current;
          } catch {
            /* ignore */
          }
          pendingSeekRef.current = null;
        }
      }}
      onTimeUpdate={() => {
        // The video is the time source while it's playing. Map the
        // element's currentTime back to timeline seconds (playhead_sec)
        // and push to the store. The store's setPlayhead throttles the
        // backend commit, so we get free local-state updates at the
        // browser's reporting rate (~4 Hz) without IPC spam.
        if (!readyRef.current || !active) return;
        const v = videoRef.current;
        if (!v) return;
        const playhead = active.clip.position_sec + (v.currentTime - active.clip.in_sec);
        if (Number.isFinite(playhead) && playhead >= 0) {
          useTimelineStore.getState().setPlayhead(playhead);
        }
      }}
    />
  );
}

export function PreviewEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-foreground-muted">
      <FilmIcon className="size-12" strokeWidth={1.25} />
      <div>
        <p className="text-sm font-medium text-foreground">Nothing on the timeline yet</p>
        <p className="mt-1 text-xs text-foreground-muted/70">
          Pick a clip from the library.
        </p>
      </div>
    </div>
  );
}
