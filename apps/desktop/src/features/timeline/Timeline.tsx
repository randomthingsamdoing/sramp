import { useEffect, useRef } from "react";

import { useTimelineStore } from "./store";
import { Ruler } from "./Ruler";
import { TrackLane } from "./Track";
import { Playhead } from "./Playhead";

const MIN_TIMELINE_SEC = 60;

export function Timeline() {
  const project = useTimelineStore((s) => s.project);
  const zoom = project.zoom;

  // Largest content time across all clips + a 60 s floor so the ruler
  // always shows enough space to drop into.
  const maxContentSec = Math.max(
    MIN_TIMELINE_SEC,
    ...project.tracks.flatMap((t) =>
      t.clips.map((c) => c.position_sec + (c.out_sec - c.in_sec) + 5),
    ),
  );
  const widthPx = maxContentSec * zoom;

  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Global pointer routing for the playhead drag.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!useTimelineStore.getState().playheadDragging) return;
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      useTimelineStore.getState().setPlayhead(Math.max(0, x / zoom));
    }
    function onUp() {
      if (useTimelineStore.getState().playheadDragging) {
        useTimelineStore.getState().setPlayheadDragging(false);
        document.body.style.cursor = "";
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [zoom]);

  /**
   * Drop detection: pointerup on the window.
   *
   * WKWebView reliably delivers `dragstart` (your logs prove it) and the
   * `pointerdown`/`pointerup` events, but `dragover` / `drop` never reach
   * the timeline DOM — confirmed by zero `dragenter` logs. So instead of
   * fighting the HTML5 drag pipeline, we listen for the global release
   * and compute drop position from `getBoundingClientRect` directly.
   *
   * The `dragging` state on the store is set by `MediaTile.dragstart` and
   * cleared here on `pointerup` (whether the drop was on-target or not).
   */
  useEffect(() => {
    const handlePointerUp = (e: PointerEvent) => {
      const state = useTimelineStore.getState();
      const drag = state.dragging;
      if (!drag) return; // not a drag — ignore ordinary clicks

      state.setDragging(null);

      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) return;

      const dropX = e.clientX - rect.left;
      const zoom = state.project.zoom;
      const positionSec = Math.max(0, dropX / zoom);
      const videoTrack = state.project.tracks.find(
        (t) => t.kind === "video",
      );
      if (!videoTrack) return;
      void state.addClipToTrack(videoTrack.id, drag.mediaId, positionSec);
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  /**
   * Click-and-drag anywhere on the inner content to scrub. The previous
   * `target === currentTarget` guard was wrong: clicks on the lane set
   * target to the lane div but currentTarget to this outer wrapper, so
   * the guard skipped. Removed — clip blocks and the playhead tab call
   * `e.stopPropagation()` on their own pointerdown so they don't trigger
   * scrub (the lane's onClick is now redundant but kept for keyboard).
   */
  const handleContentPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    e.stopPropagation();
    const state = useTimelineStore.getState();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    state.setPlayhead(Math.max(0, x / zoom));
    state.setPlayheadDragging(true);
    document.body.style.cursor = "ew-resize";
  };

  return (
    <section
      ref={sectionRef}
      className="h-32 shrink-0 overflow-x-auto border-t border-border bg-surface"
      aria-label="timeline"
    >
      <div
        ref={contentRef}
        data-timeline-content
        style={{ width: `${widthPx}px`, position: "relative" }}
        className="relative h-full"
        onPointerDown={handleContentPointerDown}
      >
        <Ruler widthPx={widthPx} />
        {project.tracks.map((t) => (
          <TrackLane key={t.id} track={t} />
        ))}
        <Playhead zoom={zoom} />
      </div>
    </section>
  );
}
