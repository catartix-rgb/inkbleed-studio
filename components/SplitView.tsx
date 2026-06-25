"use client";

import Canvas from "./Canvas";
import { FaithfulPreview, CleanPreview } from "./Previews";

/**
 * Split View — Original Paper (live draw surface), Faithful Vector and Clean
 * Logo previews shown simultaneously and updated in real time while drawing.
 */
export default function SplitView() {
  return (
    <div className="grid h-full grid-cols-3">
      <div className="flex min-h-0 flex-col border-r hairline">
        <div className="flex items-center justify-between border-b px-3 py-1.5 hairline">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-soft)]">
            Original Paper
          </span>
          <span className="text-[9px] uppercase tracking-wider text-[var(--accent)]">
            draw here
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
          <Canvas />
        </div>
      </div>
      <div className="border-r hairline">
        <FaithfulPreview />
      </div>
      <div>
        <CleanPreview />
      </div>
    </div>
  );
}
