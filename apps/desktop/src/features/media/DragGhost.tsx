import { useEffect, useState } from "react";

import { useTimelineStore } from "@/features/timeline/store";

/**
 * Visual feedback during a drag — a small floating chip that follows the
 * cursor. Mounted once at the App level. Pointer-events are disabled so
 * it never gets in the way of the real drop target.
 */
export function DragGhost() {
  const dragging = useTimelineStore((s) => s.dragging);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [dragging]);

  if (!dragging) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md border border-accent bg-surface-elevated px-3 py-1.5 text-xs text-foreground shadow-lg"
      style={{
        left: `${pos.x + 14}px`,
        top: `${pos.y + 14}px`,
      }}
    >
      <FilmIcon className="size-3.5 text-accent" />
      <span className="max-w-[12rem] truncate">{dragging.mediaName}</span>
    </div>
  );
}

function FilmIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M2 2 L22 22 M22 2 L2 22" />
    </svg>
  );
}
