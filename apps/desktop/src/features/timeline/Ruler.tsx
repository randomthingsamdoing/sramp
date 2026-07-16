import { useTimelineStore } from "./store";

interface Props {
  /** Width of the ruler in pixels — matches the inner timeline content width
   *  so the playhead sits directly on the second-mark the user sees. */
  widthPx: number;
}

/**
 * Top-of-timeline time ruler. Click anywhere to seek the playhead.
 * Major tick every 5s with a label, minor every 1s.
 */
export function Ruler({ widthPx }: Props) {
  const zoom = useTimelineStore((s) => s.project.zoom);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  const totalSec = Math.ceil(widthPx / zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec; t++) {
    if (t % 1 === 0) ticks.push(t);
  }

  return (
    <div
      style={{ width: `${widthPx}px` }}
      className="relative h-7 select-none border-b border-border-muted bg-surface"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setPlayhead(Math.max(0, x / zoom));
      }}
    >
      {ticks.map((t) => {
        const major = t % 5 === 0;
        return (
          <div
            key={t}
            className={
              "absolute top-0 border-l border-border-muted " +
              (major ? "h-full" : "h-1/2")
            }
            style={{ left: `${t * zoom}px` }}
          >
            {major && (
              <span className="absolute left-1 top-0 font-mono text-[10px] tabular-nums text-foreground-muted">
                {formatTime(t)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
