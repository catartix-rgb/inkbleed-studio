"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { MODES } from "@/lib/modes";
import { useVector } from "@/lib/useVector";
import { toSVG } from "@/lib/vectorize";
import { toPDF, toEPS, svgToPNG, download } from "@/lib/export";

export default function VectorPanel() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const detail = useStudio((s) => s.vectorDetail);
  const setVectorDetail = useStudio((s) => s.setVectorDetail);
  const showVector = useStudio((s) => s.showVector);
  const toggleVector = useStudio((s) => s.toggleVector);
  const showSketch = useStudio((s) => s.showSketchUnderVector);
  const toggleSketch = useStudio((s) => s.toggleSketchUnderVector);
  const strokeCount = useStudio((s) => s.strokes.length);
  const theme = useStudio((s) => s.theme);

  const { result, color } = useVector();
  const [busy, setBusy] = useState<string | null>(null);

  const b = result.bbox ?? { x: 0, y: 0, w: 1, h: 1 };
  const previewSvg = toSVG(result, { color, pad: 24, background: null });

  const doExport = async (kind: string) => {
    if (strokeCount === 0) return;
    setBusy(kind);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const name = `inkbleed-${mode}-${stamp}`;
      if (kind === "svg") {
        download(
          new Blob([toSVG(result, { color, pad: 40, background: null })], {
            type: "image/svg+xml",
          }),
          `${name}.svg`
        );
      } else if (kind === "pdf") {
        download(toPDF(result, { color, pad: 40 }), `${name}.pdf`);
      } else if (kind === "eps") {
        download(
          new Blob([toEPS(result, { color, pad: 40 })], {
            type: "application/postscript",
          }),
          `${name}.eps`
        );
      } else if (kind === "png") {
        const svg = toSVG(result, { color, pad: 40, background: null });
        download(await svgToPNG(svg, 2048, null), `${name}-transparent.png`);
      } else if (kind === "png4k") {
        const bg = theme === "dark" ? "#121212" : "#ffffff";
        const svg = toSVG(result, { color, pad: 40, background: null });
        download(await svgToPNG(svg, 3840, bg), `${name}-4k.png`);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {/* Live preview */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
              Live Vector Output
            </h3>
            <button
              onClick={toggleVector}
              className={`btn rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                showVector ? "btn-active" : ""
              }`}
              title="Overlay vector on canvas (V)"
            >
              {showVector ? "On canvas" : "Overlay off"}
            </button>
          </div>
          <div
            className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-md border hairline"
            style={{ background: "var(--canvas)", color }}
          >
            {strokeCount === 0 ? (
              <span className="px-6 text-center text-xs text-[var(--fg-soft)]">
                Draw something — the vector logo appears here in real time.
              </span>
            ) : (
              <div
                className="h-full w-full p-3"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Layers" value={result.paths.length} />
          <Stat label="Anchors" value={result.anchors} />
          <Stat
            label="Size"
            value={`${Math.round(b.w)}×${Math.round(b.h)}`}
            small
          />
        </section>

        {/* Mode selector */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
            Interpretation Mode
          </h3>
          <div className="flex flex-col gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`btn flex flex-col items-start rounded-md px-3 py-2 text-left ${
                  mode === m.id ? "btn-active" : ""
                }`}
              >
                <span className="text-sm font-medium">{m.label}</span>
                <span
                  className={`text-[10px] ${
                    mode === m.id
                      ? "text-[var(--bg)] opacity-70"
                      : "text-[var(--fg-soft)]"
                  }`}
                >
                  {m.blurb}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Simplification control */}
        <section>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[var(--fg-soft)]">
              Path Simplification
            </span>
            <span className="mono text-[11px]">{detail.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            className="w-full"
            min={0.2}
            max={3}
            step={0.05}
            value={detail}
            onChange={(e) => setVectorDetail(parseFloat(e.target.value))}
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--fg-soft)]">
            <span>More detail</span>
            <span>Fewer anchors</span>
          </div>
        </section>

        <label className="flex items-center justify-between text-sm">
          <span>Show sketch under vector</span>
          <input
            type="checkbox"
            checked={showSketch}
            onChange={toggleSketch}
          />
        </label>
      </div>

      {/* Export */}
      <div className="mt-auto border-t p-4 hairline">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Export
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ExportButton
            label="SVG"
            sub="vector"
            onClick={() => doExport("svg")}
            busy={busy === "svg"}
            disabled={strokeCount === 0}
          />
          <ExportButton
            label="PDF"
            sub="vector"
            onClick={() => doExport("pdf")}
            busy={busy === "pdf"}
            disabled={strokeCount === 0}
          />
          <ExportButton
            label="EPS"
            sub="vector"
            onClick={() => doExport("eps")}
            busy={busy === "eps"}
            disabled={strokeCount === 0}
          />
          <ExportButton
            label="PNG"
            sub="transparent"
            onClick={() => doExport("png")}
            busy={busy === "png"}
            disabled={strokeCount === 0}
          />
          <ExportButton
            label="PNG 4K"
            sub="3840px"
            onClick={() => doExport("png4k")}
            busy={busy === "png4k"}
            disabled={strokeCount === 0}
            wide
          />
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--fg-soft)]">
          SVG / PDF / EPS are true vector with editable layers and optimized
          Bézier curves — production-ready for Illustrator, Figma and Inkscape.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-md border py-2 hairline">
      <div
        className={`mono ${small ? "text-xs" : "text-base"} font-medium leading-tight`}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--fg-soft)]">
        {label}
      </div>
    </div>
  );
}

function ExportButton({
  label,
  sub,
  onClick,
  busy,
  disabled,
  wide,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`btn flex flex-col items-start rounded-md px-3 py-2 disabled:opacity-40 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <span className="text-sm font-medium">{busy ? "Rendering…" : label}</span>
      <span className="text-[10px] text-[var(--fg-soft)]">{sub}</span>
    </button>
  );
}
