import { useEffect } from "react";

import { MediaLibrary } from "@/features/media/library";
import { Preview, PreviewEmpty } from "@/features/preview/Preview";
import { useMediaStore } from "@/features/media/store";

export default function App() {
  const init = useMediaStore((s) => s.init);
  const clips = useMediaStore((s) => s.clips);
  const selectedClipId = useMediaStore((s) => s.selectedClipId);
  const selected = selectedClipId
    ? (clips.find((c) => c.id === selectedClipId) ?? null)
    : null;

  useEffect(() => {
    void init();
  }, [init]);

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
            {selected ? <Preview clip={selected} /> : <PreviewEmpty />}
          </section>
          <section
            className="h-32 shrink-0 border-t border-border bg-surface"
            aria-label="timeline-placeholder"
          />
        </div>
      </div>
    </main>
  );
}
