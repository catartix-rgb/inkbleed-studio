"use client";

import { useStudio } from "@/lib/store";
import { SunIcon, MoonIcon, VectorIcon, TargetIcon, SplitIcon } from "./Icons";

export default function TopBar() {
  const theme = useStudio((s) => s.theme);
  const toggleTheme = useStudio((s) => s.toggleTheme);
  const showVector = useStudio((s) => s.showVector);
  const toggleVector = useStudio((s) => s.toggleVector);
  const resetView = useStudio((s) => s.resetView);
  const mode = useStudio((s) => s.mode);
  const splitView = useStudio((s) => s.splitView);
  const toggleSplit = useStudio((s) => s.toggleSplit);

  return (
    <header className="flex h-12 items-center justify-between border-b px-3 hairline">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--fg)] text-[var(--bg)]">
            <span className="text-sm font-black leading-none">IB</span>
          </div>
          <div className="leading-none">
            <div className="text-sm font-semibold tracking-tight">
              InkBleed Studio
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--fg-soft)]">
              sketch → vector logos
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="mono hidden rounded border px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--fg-soft)] hairline sm:inline">
          {mode}
        </span>
        <button
          onClick={resetView}
          title="Reset view (0)"
          className="btn flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs"
        >
          <TargetIcon width={15} height={15} />
          <span className="hidden md:inline">Fit</span>
        </button>
        <button
          onClick={toggleVector}
          title="Toggle vector overlay (V)"
          className={`btn flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${
            showVector ? "btn-active" : ""
          }`}
        >
          <VectorIcon width={15} height={15} />
          <span className="hidden md:inline">Vector</span>
        </button>
        <button
          onClick={toggleSplit}
          title="Split view — paper · faithful · clean"
          className={`btn flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${
            splitView ? "btn-active" : ""
          }`}
        >
          <SplitIcon width={15} height={15} />
          <span className="hidden md:inline">Split</span>
        </button>
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className="btn flex h-8 w-8 items-center justify-center rounded-md"
        >
          {theme === "dark" ? (
            <SunIcon width={16} height={16} />
          ) : (
            <MoonIcon width={16} height={16} />
          )}
        </button>
      </div>
    </header>
  );
}
