import { FolderOpenIcon, PlusIcon } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/components/ui/button";
import { importClip, importFolder } from "@/lib/ipc";
import { useMediaStore } from "./store";
import { useTimelineStore } from "@/features/timeline/store";
import { MediaTile } from "./tile";

const VIDEO_FILTERS = [
  {
    name: "Video",
    extensions: ["mp4", "mov", "m4v", "mkv"],
  },
];

export function MediaLibrary() {
  const clips = useMediaStore((s) => s.clips);
  const addClip = useMediaStore((s) => s.addClip);
  const addClips = useMediaStore((s) => s.addClips);
  const selectedClipId = useMediaStore((s) => s.selectedClipId);
  const setSelected = useMediaStore((s) => s.setSelected);

  const onImportFiles = async () => {
    const selection = await open({
      multiple: true,
      filters: VIDEO_FILTERS,
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    for (const p of paths) {
      try {
        const clip = await importClip(p);
        addClip(clip);
      } catch (e) {
        console.error("importClip failed", p, e);
      }
    }
  };

  const onImportFolder = async () => {
    const folder = await open({
      directory: true,
      multiple: false,
    });
    if (!folder || typeof folder !== "string") return;
    const imported = await importFolder(folder);
    addClips(imported);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Media
        </h2>
        <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground-muted">
          {clips.length}
        </span>
      </header>
      <div className="flex gap-2 p-3">
        <Button size="sm" className="flex-1" onClick={onImportFiles}>
          <PlusIcon className="size-4" />
          Files
        </Button>
        <Button size="sm" variant="outline" onClick={onImportFolder}>
          <FolderOpenIcon className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {clips.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-foreground-muted">No clips yet.</p>
              <p className="text-xs text-foreground-muted/70">
                Import to start.
              </p>
            </div>
          ) : (
            clips.map((c) => (
              <MediaTile
                key={c.id}
                clip={c}
                selected={selectedClipId === c.id}
                onSelect={() => {
                  const wasSelected = selectedClipId === c.id;
                  setSelected(wasSelected ? null : c.id);
                  // If this clip is already on the timeline, jump the
                  // playhead to its position so the preview updates.
                  const tl = useTimelineStore
                    .getState()
                    .project.tracks.flatMap((t) => t.clips)
                    .find((c) => c.media_id === c.id);
                  if (tl && !wasSelected) {
                    useTimelineStore.getState().setPlayhead(tl.position_sec);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
