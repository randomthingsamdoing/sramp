import { useMediaStore } from "@/features/media/store";
import { useTimelineStore } from "./store";
import { cn } from "@/lib/utils";
import type { TimelineClip } from "@/lib/types";

interface Props {
  trackId: string;
  clip: TimelineClip;
  zoom: number;
}

/**
 * One clip block on a track lane. Width = duration × zoom; position from
 * position_sec × zoom. Selecting seeks the playhead to the clip's start
 * so the user can immediately scrub through it.
 */
export function TimelineClipBlock({ clip, zoom }: Props) {
  const playheadSec = useTimelineStore((s) => s.project.playhead_sec);
  const mediaClip = useMediaStore((s) =>
    s.clips.find((c) => c.id === clip.media_id),
  );

  const leftPx = clip.position_sec * zoom;
  const widthPx = (clip.out_sec - clip.in_sec) * zoom;
  const isActive =
    playheadSec >= clip.position_sec &&
    playheadSec < clip.position_sec + (clip.out_sec - clip.in_sec);

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        useTimelineStore.getState().setPlayhead(clip.position_sec);
      }}
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      className={cn(
        "absolute top-1 bottom-1 overflow-hidden rounded-md border px-2 text-left",
        "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        isActive
          ? "border-accent bg-accent/15"
          : "border-border bg-surface-elevated hover:border-border-muted",
      )}
      title={mediaClip?.name ?? clip.id}
    >
      <p className="truncate text-xs text-foreground/90">
        {mediaClip?.name ?? "(unknown)"}
      </p>
    </button>
  );
}
