import { FilmIcon, MusicIcon } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

import { useTimelineStore } from "@/features/timeline/store";
import { cn } from "@/lib/utils";
import type { MediaClip, ProxyStatus } from "@/lib/types";

const PROXY_LABEL: Record<ProxyStatus, string | null> = {
  pending: "Proxy pending",
  generating: "Proxy…",
  ready: "720p",
  source: null,
  failed: "Proxy failed",
};

const PROXY_TONE: Record<ProxyStatus, string> = {
  pending: "bg-surface-elevated/80 text-foreground-muted",
  generating: "bg-accent/20 text-accent",
  ready: "bg-emerald-500/20 text-emerald-300",
  source: "",
  failed: "bg-red-500/20 text-red-300",
};

interface Props {
  clip: MediaClip;
  selected: boolean;
  onSelect: () => void;
}

export function MediaTile({ clip, selected, onSelect }: Props) {
  const hasVideo = (clip.probe?.width ?? 0) > 0 && (clip.probe?.height ?? 0) > 0;
  const proxyLabel = PROXY_LABEL[clip.proxy.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseDown={() => {
        // Mark the clip as in-flight for the drop. We don't use HTML5
        // drag-and-drop (draggable=true) because WKWebView puts the WebView
        // into AppKit drag-mode the moment HTML5 drag starts, intercepting
        // `pointerup` and `drop` so they never reach the WebView.
        // Pure mouse events fire reliably.
        useTimelineStore.getState().setDragging({
          mediaId: clip.id,
          mediaName: clip.name,
        });
      }}
      aria-pressed={selected}
      className={cn(
        "group overflow-hidden rounded-md border bg-surface-elevated text-left",
        "cursor-grab transition-colors active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        selected ? "border-accent" : "border-border hover:border-border-muted",
      )}
    >
      <div className="relative aspect-video bg-background">
        {clip.thumb_path && hasVideo ? (
          <img
            src={convertFileSrc(clip.thumb_path)}
            alt={clip.name}
            className="absolute inset-0 size-full object-cover"
            draggable={false}
            onError={(e) => {
              console.error(
                "[tile] thumb load failed:",
                clip.thumb_path,
                convertFileSrc(clip.thumb_path ?? ""),
                e,
              );
            }}
          />
        ) : hasVideo ? (
          <div className="flex size-full items-center justify-center text-foreground-muted">
            <FilmIcon className="size-6" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-foreground-muted">
            <MusicIcon className="size-6" strokeWidth={1.5} />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              Audio only
            </span>
          </div>
        )}
        {clip.probe?.is_hdr ? (
          <span className="absolute right-1 top-1 rounded bg-background/80 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            HDR
          </span>
        ) : null}
        {proxyLabel && (
          <span
            className={cn(
              "absolute bottom-1 left-1 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              PROXY_TONE[clip.proxy.status],
            )}
          >
            {proxyLabel}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p
          className="truncate text-xs font-medium text-foreground"
          title={clip.name}
        >
          {clip.name}
        </p>
        <p className="text-[11px] text-foreground-muted">
          {clip.probe ? formatDuration(clip.probe.duration_sec) : "—"}
          {hasVideo ? ` · ${clip.probe!.width}×${clip.probe!.height}` : ""}
          {clip.probe?.video_codec && hasVideo ? ` · ${clip.probe.video_codec}` : ""}
          {clip.probe?.audio_codec && !hasVideo ? ` · ${clip.probe.audio_codec}` : ""}
        </p>
      </div>
    </button>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
