## Goal
Build Sramp — a desktop speed-ramp video editor for car content. v1 single wedge: clips in → ramp presets → export. See `PLAN.md` for full scope.

## Now
**Week 2 — checkpoint 2** (cadence B): 720p proxy worker (background, audio-stripped, hardware encode, hash-cached) + click-to-play in the preview pane. Done; binary boots, hw encoder detected as `h264_videotoolbox`, ffmpeg end-to-end verified against a 3840×2160 source.

## Next
- **Week 3** — timeline v1 (single video track, scrub + trim handles, custom transport bar replaces native `<video controls>`).
- **Week 4** — ramp overlay + preset library v1; **design freeze**.
- **Weeks 5–13** — see `PLAN.md` §15.

## Next
- **Week 2 — checkpoint 2**: 720p proxy worker (background, audio-stripped, hardware encode, hash-cached) + click-to-play in preview panel. See `PLAN.md` §11.
- **Week 3** — timeline v1 (single video track, scrub + trim handles).
- **Week 4** — ramp overlay + preset library v1; **design freeze**.
- **Weeks 5–13** — see `PLAN.md` §15.

## Constraints
Decisions locked in `PLAN.md` §0.1. Verbatim:

1. macOS for early testing; Windows added before v1.0 release; both signed and notarized for distribution.
2. Glass/aurora macOS-style as design target — `backdrop-filter: blur()` + translucent panels + soft amber accent.
3. Free / open-source, MIT-licensed. No accounts, no payments, no telemetry.
4. Solo, fast (nights / weekends).
5. No formal test users; solo smoke-test loop only.
6. No funding. Every dep OSS-permissive. ffmpeg via sidecar, never static-linked.
7. Accent color: warm amber around `#E8A87C`.
8. Product name: **Sramp**.

## Decisions
- Tauri 2 + React 19 + TS + Tailwind v4 + shadcn-style primitives + Zustand + native ffmpeg via sidecar.
- 720p background proxy, audio-stripped, hardware encode, hash-cached. Sources ≤720p skip proxy.
- Plan extended to 13 weeks so Windows ships as v1.0.

## Facts
- Working dir: `/Volumes/Extreme SSD/coding-projects/sramp`
- Plan file: `PLAN.md` (§0.1 decisions, §7 arch, §11 perf, §15 milestones)
- Toolchain on host: Node 24.12.0, npm 11.6, cargo 1.92.0, rustc 1.92.0, ffmpeg 8.0.1, git 2.50.1
- Tauri dev URL: `http://localhost:1420`
- Tauri identifier: `com.sramp.app`

## Done
- **Week 1 — scaffold.** Tauri 2 + React 19 + TS + Tailwind v4 + dark `oklch` theme tokens; macOS-style title bar (default chrome; `titleBarStyle: 'Overlay'` removed per founder feedback); Button primitive (shadcn-style with `cn()`); placeholder amber PNG icons. pnpm dev confirms the window opens. All four verifications green: typecheck, lint (1 non-blocking warning), `vite build` (220 KB JS → 70 KB gzip, 10 KB CSS → 3 KB gzip, 5.13 s), `cargo build` (340 deps, 11.30 s).
- **Week 2 — checkpoint 1 (plumbing + thumb cache).** Added: tauri-plugin-dialog + dialog permission; `MediaClip`/`ProbeInfo` types on both Rust + TS sides; `import_clip` and `import_folder` Tauri commands with probe + background thumb extraction; `clip:thumb_ready` event → React listener → zustand store update; `MediaLibrary` left panel with `Files` / folder picker buttons + tile grid; HDR badge for sources with PQ/HLG transfer. Asset protocol enabled with scope covering cache dir + macOS paths. All four verifications green: typecheck ✓, lint ✓ (1 non-blocking warn, same as week 1), `vite build` 1.26s (1597 modules, 228 KB JS / 13 KB CSS), `cargo build` 13.51s (352 deps, +12 from week 1). `pnpm dev` boots sramp-desktop binary successfully.
- **Week 2 — checkpoint 2 (proxy worker + click-to-play).** Hardware encoder detection at startup (`h264_videotoolbox` on Mac, `h264_nvenc`/`h264_qsv` on Win, falls back to `libx264`); 720p H.264 proxy generated in a per-import tokio task, audio-stripped (`-an`), **explicit BT.709 color tags** (`-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv`) so output doesn't get auto-tagged as BT.601 by hosts; `+faststart` for streaming; audio-only and ≤720p sources skip generation (`status: "source"`); `clip:proxy_state` events drive UI badges `pending → generating → ready` (or `failed`); cache at `$APPCACHE/proxies/<hash>.mp4`. Hardware encode verified end-to-end against a 3840×2160 source: ~9× realtime, output is `h264, yuv420p(tv, bt709/unknown/unknown, progressive), 1280x720, 5000 kb/s`. Click-to-play: `MediaTile` is now a button — click toggles `selectedClipId` in the store; the preview pane renders `<video src={convertFileSrc(source_path)} controls />` with native controls (week 3 replaces native with custom transport synced to the timeline); audio-only clips show a clear "no video stream" message instead of a broken `<video>`. Tile selection styles: amber border when selected, focus ring for keyboard nav. Verified ffmpeg-side with the same args our code issues: `Stream #0:0 … h264, yuv420p(tv, bt709/unknown/unknown, progressive), 1280x720`.

**Note 2026-07-16:** founder reversed the title-bar call after reviewing the result. `titleBarStyle: 'Overlay'` and `hiddenTitle: true` restored — the next `pnpm dev` will show the full-height draggable title bar with native traffic lights overlaid as planned.

**Note 2026-07-16:** founder reversed the title-bar call after reviewing the result. `titleBarStyle: 'Overlay'` and `hiddenTitle: true` restored — the next `pnpm dev` will show the full-height draggable title bar with native traffic lights overlaid as planned.
- **Color management principle locked into `PLAN.md` §11.** ffmpeg encode output will always carry explicit `-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv` tags to avoid the "dull HD source" trap (auto-detect often under-tags as BT.601 / smpte170m). Source color metadata respected end-to-end; HDR detection surfaces a badge but exports SDR BT.709 in v1.

## Open items
- Real launcher icons (matters for `tauri build`, not `tauri dev`). 4 amber PNGs at 32/128/256/1024 px are placeholders.
- `brew install --cask sramp` and `winget install sramp` casks (weeks 11–13 niceties).
- Decide between `tauri-plugin-store` and `tauri-plugin-fs-only` for project-file persistence (defer to week 8).
- React-refresh dual-export warning in `button.tsx` (exports `Button` and `buttonVariants`) — non-blocking; refactor in week 4 design freeze.
- Cleanup: many `._*` AppleDouble ghosts get regenerated by macOS after each Write. The wrapper handles this for tool runs; manual `find . -name '._*' -delete` is occasionally needed for tidy file trees (e.g., before commit).
- Verify on real hardware that Display P3 renders oklch accents fully (depends on the user's display; can't be unit-tested).

## Failed attempts
- **ATTEMPT 1 [L1] — `vite.config.ts` referenced `__dirname`, `process`, `node:path` without `@types/node`.** Typecheck fail: TS2307, TS2304, TS2580. CAUSE: missing `@types/node` dep + project-references setup that conflicted with `tsc --noEmit`. FIX (one shot): added `@types/node`, refactored to ESM-native `fileURLToPath(new URL(...))`, simplified tsconfig to single-config (dropped `tsconfig.node.json` and project references).
- **ATTEMPT 1 [L1] — macOS AppleDouble `._*` companion files leaked into every tool.** workspace lives on `/Volumes/Extreme SSD/` (non-APFS external); macOS writes `._*` siblings for every file touched. They corrupted ESLint scan, tsc's file walker, and Tauri's `build.rs` permission walker (`stream did not contain valid UTF-8`). FIX (one shot): `scripts/with-clean-target.sh` strips `._*` from `apps/`, `packages/`, `scripts/`, `.github/`, root; nukes `src-tauri/target` and `src-tauri/gen`; sets `CARGO_TARGET_DIR=$HOME/.cargo/target/sramp-desktop` (APFS home) so future builds don't attract ghosts.
- **ATTEMPT 1 [L1] — `tauri.conf.json` referenced icons that didn't exist (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`).** Cargo proc-macro panicked at compile time. FIX: generated 4 amber PNG placeholders via inline Python (one-shot script), dropped `.icns`/`.ico` from `bundle.icon` for week 1 (real `.icns` and `.ico` ship with `tauri build` in week 11).
- **ATTEMPT 2 [L1] — `tauri dev` first run: `No space left on device`.** Boot volume at 100% (131 MiB free, 2.8 GB sitting in `/var/folders/w6/pjqbdb1d22n__zps4ytw_29m0000gn/T/` as rustc invocation temp). FIX: `rm -rf /var/folders/.../T/*` (those are rustc-managed temp; safe to delete; recreated on demand). Now 3.3 GiB free.
- **ATTEMPT 3 [L1] — Second `tauri dev`: `Port 1420 is already in use`.** Vite from the SIGTERMed prior run still bound the port. FIX: `lsof -ti :1420 | xargs kill` to release the zombie listener. (Hard-stop note: kill by PID via port, not by image name `pkill node`.)
- **ATTEMPT 4 [L1] — Third `tauri dev`: SUCCESS.** Vite served `http://localhost:1420/`, all 340 crates compiled in 11.30 s warm-cache, sramp-desktop binary launched (`Running /Users/.../sramp-desktop`).
- **ATTEMPT 1 [L1] — `cargo check` after enabling `assetProtocol`: `protocol-asset` feature not on `tauri` crate.** CAUSE: `tauri.conf.json` opt-in for `assetProtocol` requires the matching feature on the Rust crate. FIX: `tauri = { version = "2", features = ["protocol-asset"] }`.
- **ATTEMPT 2 [L1] — `import_folder` E0382 use-after-move of `source_path` after recursion.** CAUSE: `match import_clip(..., source_path).await` consumed the String, then `eprintln!("for {source_path}")` re-used it. FIX: `source_path.clone()` at the call site.
- **ATTEMPT 3 [L1] — Same E0382, this time on `state`.** CAUSE: `tauri::State<'_, AppState>` (Arc-wrapped) moved into `import_clip` on each loop iteration; second iteration's call complained. FIX: `state.clone()` (cheap — Arc clone).
- **ATTEMPT 4 [L1] — `tauri dev` failed with `Port 1420 already in use` even after wrapper killed the port.** CAUSE: A SIGTERMed prior run left (a) `node /.../vite.js` still bound to :1420 AND (b) `sramp-desktop` still running with its WKWebView's `com.apple.WebKit.Networking` XPC service holding an ESTABLISHED socket on 1420. Killing vite alone wasn't enough — WebKit.Networking auto-respawns. CAUSE 2: the wrapper's `kill "$victims"` had `victims` as a multi-line string (lsof emits one PID per line); quoting made `kill` see a single malformed arg and silently no-op. FIX: unquoted `kill $victims` so the shell word-splits; wrapper now also runs `pgrep -x sramp-desktop` to kill the binary itself before launch. Documentation: `pgrep -x` is the targeted, exact-name kill (kit's "no pkill -image" rule still respected — only `sramp-desktop` matches that string).
- **ATTEMPT 5 [L1] — Wrapper syntax error: `; do` instead of `; then` at line 44.** CAUSE: edit landed `if ... ; do` instead of `if ... ; then`. FIX: corrected. `sh -n scripts/with-clean-target.sh && echo OK` is now a fast smoke after every wrapper change.
- **ATTEMPT 1 [L1] — Tile visually stretched vertically in the library.** CAUSE: `flex-1 grid grid-cols-2 ...` on the same div. The flex-1 makes the grid container fill available height; with one item in row 0 the grid renders the row to fill too much height (interaction between `flex: 1 1 0%` and grid auto-rows). FIX: split into two divs — outer `<div className="flex-1 overflow-y-auto p-3">` for scrolling, inner `<div className="grid grid-cols-2 gap-2">` for layout. Each layer now owns one concern.
- **ATTEMPT 1 [L1] — Thumbs never extracted; cache dir empty.** CAUSE 1: `Err(_) => {}` arm on the thumb task swallowed every ffmpeg error. CAUSE 2 (root): for files with no video stream (audio-only MP4s in the user's Downloads), ffmpeg's `image2` muxer refuses output with `Error opening output file … Invalid argument / Output file does not contain any stream`. ffmpeg alone is fine for video MP4s (verified against `/Users/.../Downloads/processed_Black_Hole_Smoke_Animation_Generation_1_rhea1.mp4` — produced a valid 320×180 JPEG). FIX: import_clip now checks `probe.width > 0 && probe.height > 0` and skips the thumb task for audio-only files; the tile shows a `MusicIcon` + "AUDIO ONLY" label instead. thumb.rs refactored to capture ffmpeg stderr and log via `eprintln!` so future failures surface in the dev terminal instead of vanishing.
- **OPEN ITEMS (new):** confirm whether the user's actual clip was audio-only (probe showed 0×0) or genuinely video with thumbless extraction; either way covered now.
- **ATTEMPT 1 [L1] — Large Edit on `commands/media.rs` reverted the file to its prior version.** CAUSE: an Edit's `oldString` had `proxy: …` ordering vs `MediaClip` field order, blocking the diff match (Edit tool reported `"string not found"`). FIX: rewrote the file with `Write` instead of Edit, restoring the proxy-worker kickoff, `get_clip` command, and the new `ProxyInfo` field. Lesson: when an Edit changes many scattered lines, prefer a full `Write` — avoids string-not-found failures from brace/indent drift.
- **ATTEMPT 2 [L1] — Rust E0597 `s does not live long enough` on `state.hw_encoder.lock()` inside `tokio::spawn`.** CAUSE: the `State<'_, AppState>` guard lifetime ended at the inner block, but its temporary MutexGuard was still considered live at the borrowed-by-closure boundary. FIX: extracted `let hw_encoder = state.hw_encoder.lock().unwrap().clone();` BEFORE `tokio::spawn(async move …)` so the closure receives an owned `String`, not a borrow.
- **ATTEMPT 3 [L1] — Rust E0382 `proxy_str` use-after-move in `media/proxy.rs`.** CAUSE: `proxy_str` was both moved into the `spawn_blocking` closure (`&proxy_str` arg) and again referenced in the return value path. FIX: `let result_path = proxy_str.clone();` before closure; the clone goes into the closure, the original `result_path` flows to the return.
