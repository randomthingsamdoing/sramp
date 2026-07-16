import { useTimelineStore } from "./store";
import { TimelineClipBlock } from "./Clip";
import type { Track } from "@/lib/types";

interface Props {
  track: Track;
}

/**
 * One track lane — a fixed-height row that hosts TimelineClipBlock(s)
 * positioned by absolute coordinates against the shared timeline width.
 *
 * Clicking the empty area of the lane seeks the playhead. Clip blocks have
 * their own onClick that calls e.stopPropagation, so click-on-clip doesn't
 * fall through to this handler.
 */
export function TrackLane({ track }: Props) {
  const zoom = useTimelineStore((s) => s.project.zoom);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  return (
    <div
      className="relative h-16 w-full border-t border-border-muted bg-background"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return; // ignore clicks bubbling up from clip blocks
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setPlayhead(Math.max(0, x / zoom));
      }}
    >
      {track.clips.map((c) => (
        <TimelineClipBlock
          key={c.id}
          trackId={track.id}
          clip={c}
          zoom={zoom}
        />
      ))}
    </div>
  );
}
