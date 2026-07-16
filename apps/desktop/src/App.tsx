import { useEffect } from "react";

import { MediaLibrary } from "@/features/media/library";
import { Preview, PreviewEmpty } from "@/features/preview/Preview";
import { Timeline } from "@/features/timeline/Timeline";
import { DragGhost } from "@/features/media/DragGhost";
import { useMediaStore } from "@/features/media/store";
import { useTimelineStore } from "@/features/timeline/store";

export default function App() {
  const initMedia = useMediaStore((s) => s.init);
  const initTimeline = useTimelineStore((s) => s.init);

  useEffect(() => {
    void initMedia();
    void initTimeline();
  }, [initMedia, initTimeline]);

  const hasActiveClip = useTimelineStore(
    (s) => s.getActiveTimelineClip() != null,
  );

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        data-tauri-drag-region
        className="flex h-9 shrink-0 select-none items-center border-b border-border px-4"
      >
        <span className="text-xs font-medium tracking-wide text-foreground-muted">
          SRAMP
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <MediaLibrary />
        <div className="flex flex-1 flex-col overflow-hidden">
          <section className="flex flex-1 items-center justify-center overflow-hidden bg-background">
            {hasActiveClip ? <Preview /> : <PreviewEmpty />}
          </section>
          <Timeline />
        </div>
      </div>
      <DragGhost />
    </main>
  );
}
