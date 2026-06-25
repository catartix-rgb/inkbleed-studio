"use client";

import { useStudio } from "@/lib/store";

export default function StatusBar() {
  const viewport = useStudio((s) => s.viewport);
  const tool = useStudio((s) => s.tool);
  const brush = useStudio((s) => s.brush);
  const strokes = useStudio((s) => s.strokes.length);
  const grid = useStudio((s) => s.grid);
  const symmetry = useStudio((s) => s.symmetry);

  return (
    <div className="mono flex h-7 items-center gap-4 border-t px-3 text-[10px] text-[var(--fg-soft)] hairline">
      <span>{Math.round(viewport.scale * 100)}%</span>
      <span className="uppercase tracking-wider">{tool}</span>
      <span>{brush.style}</span>
      <span>{strokes} strokes</span>
      <div className="ml-auto flex items-center gap-4">
        {grid.snap && <span className="text-[var(--accent)]">SNAP</span>}
        {symmetry.enabled && (
          <span className="text-[var(--accent)]">
            SYM ×{symmetry.axes}
            {symmetry.mirror ? "M" : ""}
          </span>
        )}
        <span className="hidden sm:inline">
          scroll = zoom · space/H = pan · B = brush · V = vector
        </span>
      </div>
    </div>
  );
}
