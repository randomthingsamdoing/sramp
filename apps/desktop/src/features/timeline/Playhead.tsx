import { useEffect, useRef } from "react";

import { useTimelineStore } from "./store";

interface Props {
  zoom: number;
}

/**
 * Vertical playhead line + draggable tab. The line position is derived
 * from `project.playhead_sec × zoom`. On pointerdown the tab sets
 * `playheadDragging=true`; the Timeline container listens for the global
 * pointermove pointerup and routes through. We resolve the timeline
 * container via a `data-timeline-content` attribute the parent sets.
 */
export function Playhead({ zoom }: Props) {
  const playheadSec = useTimelineStore((s) => s.project.playhead_sec);
  const playheadDragging = useTimelineStore((s) => s.playheadDragging);
  const setPlayheadDragging = useTimelineStore((s) => s.setPlayheadDragging);

  const draggingRef = useRef(false);

  useEffect(() => {
    draggingRef.current = playheadDragging;
  }, [playheadDragging]);

  const leftPx = playheadSec * zoom;

  return (
    <>
      <button
        type="button"
        aria-label="Drag playhead"
        className="pointer-events-auto absolute top-0 z-20 -translate-x-1/2 cursor-ew-resize select-none text-accent"
        style={{ left: `${leftPx}px`, width: "12px", height: "16px" }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPlayheadDragging(true);
          document.body.style.cursor = "ew-resize";
        }}
      >
        <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
          <path
            d="M0 0 L12 0 L12 16 L6 12 L0 16 Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <div
        className="pointer-events-none absolute top-3 bottom-0 z-10 w-px bg-accent"
        style={{ left: `${leftPx}px` }}
        aria-hidden="true"
      />
    </>
  );
}
