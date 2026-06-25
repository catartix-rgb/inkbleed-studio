"use client";

import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import Canvas from "@/components/Canvas";
import VectorOverlay from "@/components/VectorOverlay";
import Toolbar from "@/components/Toolbar";
import LeftPanel from "@/components/LeftPanel";
import VectorPanel from "@/components/VectorPanel";
import TopBar from "@/components/TopBar";
import StatusBar from "@/components/StatusBar";

export default function Page() {
  const theme = useStudio((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {/* Left rail */}
        <aside className="flex shrink-0 flex-col border-r hairline panel">
          <Toolbar />
        </aside>

        {/* Left properties */}
        <aside className="hidden w-64 shrink-0 border-r hairline panel lg:block">
          <LeftPanel />
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1">
          {mounted && <Canvas />}
          <VectorOverlay />
          <ModeHud />
        </main>

        {/* Right panel */}
        <aside className="hidden w-72 shrink-0 flex-col border-l hairline panel md:flex">
          <VectorPanel />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}

/** Floating mode chip + empty-state hint over the canvas */
function ModeHud() {
  const strokes = useStudio((s) => s.strokes.length);
  if (strokes > 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="max-w-sm text-center">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--fg-soft)]">
          InkBleed Studio
        </div>
        <p className="text-sm text-[var(--fg-soft)]">
          Sketch a logo concept with the ink brush. When you lift the pen, it
          becomes a clean, editable vector — expressive and imperfect by design.
        </p>
      </div>
    </div>
  );
}
