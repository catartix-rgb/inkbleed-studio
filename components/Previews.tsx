"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { useVector } from "@/lib/useVector";
import { toSVG } from "@/lib/vectorize";
import { buildLayout, layoutToSVG } from "@/lib/exporter";

function Frame({
  label,
  children,
  bg,
}: {
  label: string;
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5 hairline">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-soft)]">
          {label}
        </span>
      </div>
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-hidden p-4"
        style={{ background: bg ?? "var(--bg)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Clean optimized-Bézier preview (cheap — updates every change). */
export function CleanPreview() {
  const { result, color } = useVector();
  const strokeCount = useStudio((s) => s.strokes.length);
  if (strokeCount === 0) return <Empty />;
  const svg = toSVG(result, { color, pad: 24, background: null });
  return (
    <Frame label="Clean Logo">
      <div
        className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
        style={{ color }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </Frame>
  );
}

/** Faithful traced-vector preview (debounced — tracing the ink is heavier). */
export function FaithfulPreview() {
  const revision = useStudio((s) => s.revision);
  const paperRevision = useStudio((s) => s.paperRevision);
  const strokeCount = useStudio((s) => s.strokes.length);
  const [svg, setSvg] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (strokeCount === 0) {
      setSvg("");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const st = useStudio.getState();
      const layout = buildLayout({
        strokes: st.strokes,
        paper: st.paper,
        ink: st.ink,
        artboard: st.artboard,
        dpi: st.dpi,
        mode: st.mode,
        exportMode: "faithful",
        inkColor: st.theme === "dark" ? "#f2f2ee" : "#0a0a0a",
      });
      setSvg(layoutToSVG(layout, { transparent: true }));
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [revision, paperRevision, strokeCount]);

  if (strokeCount === 0) return <Empty label="Faithful Vector" />;
  return (
    <Frame label="Faithful Vector">
      {svg ? (
        <div
          className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span className="ink-pulse text-[11px] text-[var(--fg-soft)]">
          tracing ink…
        </span>
      )}
    </Frame>
  );
}

function Empty({ label = "Clean Logo" }: { label?: string }) {
  return (
    <Frame label={label}>
      <span className="px-4 text-center text-[11px] text-[var(--fg-soft)]">
        Draw to preview
      </span>
    </Frame>
  );
}
