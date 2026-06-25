"use client";

import { useState } from "react";
import BrushPanel from "./BrushPanel";
import InkLab from "./InkLab";

export default function LeftPanel() {
  const [tab, setTab] = useState<"brush" | "lab">("brush");
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b hairline">
        {(
          [
            ["brush", "Brush"],
            ["lab", "InkBleed Lab"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              tab === id
                ? "border-b-2 border-[var(--fg)] text-[var(--fg)]"
                : "text-[var(--fg-soft)] hover:text-[var(--fg)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "brush" ? <BrushPanel /> : <InkLab />}
      </div>
    </div>
  );
}
