"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { MODES } from "@/lib/modes";
import { useVector } from "@/lib/useVector";
import { toSVG } from "@/lib/vectorize";
import { download } from "@/lib/export";
import { PRESETS, DPI_PRESETS, metrics, type Unit } from "@/lib/artboard";
import {
  buildLayout,
  layoutToSVG,
  layoutToPDF,
  layoutToEPS,
  layoutToPNG,
  logoMasterZip,
  type ExportMode,
} from "@/lib/exporter";

const CATS = ["ISO", "US", "Social", "Large"] as const;

export default function VectorPanel() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const detail = useStudio((s) => s.vectorDetail);
  const setVectorDetail = useStudio((s) => s.setVectorDetail);
  const showVector = useStudio((s) => s.showVector);
  const toggleVector = useStudio((s) => s.toggleVector);
  const strokeCount = useStudio((s) => s.strokes.length);

  const artboard = useStudio((s) => s.artboard);
  const setArtboard = useStudio((s) => s.setArtboard);
  const setCustomArtboard = useStudio((s) => s.setCustomArtboard);
  const dpi = useStudio((s) => s.dpi);
  const setDpi = useStudio((s) => s.setDpi);
  const exportMode = useStudio((s) => s.exportMode);
  const setExportMode = useStudio((s) => s.setExportMode);

  const { result, color } = useVector();
  const [busy, setBusy] = useState<string | null>(null);

  const m = metrics(artboard, dpi);
  const previewSvg = toSVG(result, { color, pad: 24, background: null });

  const args = (em: ExportMode) => {
    const st = useStudio.getState();
    return {
      strokes: st.strokes,
      paper: st.paper,
      ink: st.ink,
      artboard: st.artboard,
      dpi: st.dpi,
      mode: st.mode,
      exportMode: em,
      inkColor: color,
    };
  };

  const fileName = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `inkbleed-${artboard.id}-${exportMode}-${stamp}`;
  };

  const doExport = async (kind: string) => {
    if (strokeCount === 0) return;
    setBusy(kind);
    try {
      const name = fileName();
      const layout = buildLayout(args(exportMode));
      if (kind === "svg") {
        download(
          new Blob([layoutToSVG(layout, { transparent: true })], {
            type: "image/svg+xml",
          }),
          `${name}.svg`
        );
      } else if (kind === "pdf") {
        download(layoutToPDF(layout), `${name}.pdf`);
      } else if (kind === "eps") {
        download(
          new Blob([layoutToEPS(layout)], { type: "application/postscript" }),
          `${name}.eps`
        );
      } else if (kind === "png") {
        download(await layoutToPNG(layout, m.pxW, true), `${name}-transparent.png`);
      } else if (kind === "pngflat") {
        download(await layoutToPNG(layout, m.pxW, false), `${name}-${dpi}dpi.png`);
      } else if (kind === "master") {
        const faithful = buildLayout(args("faithful"));
        const clean = buildLayout(args("clean"));
        download(
          await logoMasterZip(faithful, clean, `inkbleed-${artboard.id}`, Math.min(m.pxW, 4096)),
          `${name}-logo-master.zip`
        );
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
              Vector Output
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
          <Stat label="Artboard" value={artboard.label} small />
        </section>

        {/* Artboard */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
            Artboard
          </h3>
          <select
            className="btn w-full rounded-md px-2 py-1.5 text-sm"
            value={artboard.id}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) setArtboard(p);
            }}
          >
            {CATS.map((cat) => (
              <optgroup key={cat} label={cat}>
                {PRESETS.filter((p) => p.category === cat).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.w}×{p.h} {p.unit})
                  </option>
                ))}
              </optgroup>
            ))}
            {artboard.id === "custom" && (
              <option value="custom">Custom ({artboard.w}×{artboard.h} {artboard.unit})</option>
            )}
          </select>
          <CustomArtboard onApply={setCustomArtboard} unit={artboard.unit} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[var(--fg-soft)]">
              DPI
            </span>
            <select
              className="btn rounded-md px-2 py-1 text-xs"
              value={dpi}
              onChange={(e) => setDpi(parseInt(e.target.value))}
            >
              {DPI_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d} dpi
                </option>
              ))}
            </select>
          </div>
          <p className="mono text-[10px] leading-relaxed text-[var(--fg-soft)]">
            {m.summary}
          </p>
        </section>

        {/* Export mode (dual system) */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
            Export Engine
          </h3>
          <div className="grid grid-cols-2 gap-1">
            <ModeTab
              active={exportMode === "faithful"}
              onClick={() => setExportMode("faithful")}
              title="Faithful Ink"
              sub="Traces real ink · texture, edges, bleed"
            />
            <ModeTab
              active={exportMode === "clean"}
              onClick={() => setExportMode("clean")}
              title="Clean Logo"
              sub="Optimized Bézier · minimal anchors"
            />
          </div>
        </section>

        {/* Interpretation mode (clean only) */}
        {exportMode === "clean" && (
          <>
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
                Interpretation Mode
              </h3>
              <div className="flex flex-col gap-1">
                {MODES.map((md) => (
                  <button
                    key={md.id}
                    onClick={() => setMode(md.id)}
                    className={`btn flex flex-col items-start rounded-md px-3 py-2 text-left ${
                      mode === md.id ? "btn-active" : ""
                    }`}
                  >
                    <span className="text-sm font-medium">{md.label}</span>
                    <span
                      className={`text-[10px] ${
                        mode === md.id
                          ? "text-[var(--bg)] opacity-70"
                          : "text-[var(--fg-soft)]"
                      }`}
                    >
                      {md.blurb}
                    </span>
                  </button>
                ))}
              </div>
            </section>

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
          </>
        )}
        {exportMode === "faithful" && (
          <p className="rounded-md border p-3 text-[11px] leading-relaxed text-[var(--fg-soft)] hairline">
            Faithful export traces the rendered ink itself — edge irregularities,
            bleeding, dry-brush texture, marker streaks, pressure variation and
            calligraphic contrast are preserved. Higher node count by design.
          </p>
        )}
      </div>

      {/* Export */}
      <div className="mt-auto border-t p-4 hairline">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Export · {exportMode === "faithful" ? "Faithful Ink" : "Clean Logo"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ExportButton label="SVG" sub="vector" onClick={() => doExport("svg")} busy={busy === "svg"} disabled={strokeCount === 0} />
          <ExportButton label="PDF" sub="print vector" onClick={() => doExport("pdf")} busy={busy === "pdf"} disabled={strokeCount === 0} />
          <ExportButton label="EPS" sub="Illustrator" onClick={() => doExport("eps")} busy={busy === "eps"} disabled={strokeCount === 0} />
          <ExportButton label="PNG" sub="transparent" onClick={() => doExport("png")} busy={busy === "png"} disabled={strokeCount === 0} />
          <ExportButton label={`PNG @ ${dpi}`} sub={`${m.pxW}px`} onClick={() => doExport("pngflat")} busy={busy === "pngflat"} disabled={strokeCount === 0} wide />
        </div>
        <button
          onClick={() => doExport("master")}
          disabled={strokeCount === 0 || busy === "master"}
          className="btn-active mt-2 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {busy === "master" ? "Packaging…" : "★ Logo Master Export"}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--fg-soft)]">
          Master Export bundles faithful + clean SVG, print PDF, transparent PNG,
          monochrome, inverted, outlined and EPS source into one .zip.
        </p>
      </div>
    </div>
  );
}

function CustomArtboard({
  onApply,
  unit: curUnit,
}: {
  onApply: (w: number, h: number, unit: Unit) => void;
  unit: Unit;
}) {
  const [w, setW] = useState("1080");
  const [h, setH] = useState("1080");
  const [unit, setUnit] = useState<Unit>(curUnit);
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={w}
        onChange={(e) => setW(e.target.value)}
        className="btn w-full rounded px-1.5 py-1 text-xs"
        placeholder="W"
      />
      <span className="text-[10px] text-[var(--fg-soft)]">×</span>
      <input
        type="number"
        value={h}
        onChange={(e) => setH(e.target.value)}
        className="btn w-full rounded px-1.5 py-1 text-xs"
        placeholder="H"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as Unit)}
        className="btn rounded px-1 py-1 text-xs"
      >
        <option value="px">px</option>
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="in">in</option>
      </select>
      <button
        onClick={() => {
          const wn = parseFloat(w);
          const hn = parseFloat(h);
          if (wn > 0 && hn > 0) onApply(wn, hn, unit);
        }}
        className="btn rounded px-2 py-1 text-xs"
        title="Apply custom size"
      >
        Set
      </button>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn flex flex-col items-start rounded-md px-2.5 py-2 text-left ${
        active ? "btn-active" : ""
      }`}
    >
      <span className="text-xs font-semibold">{title}</span>
      <span
        className={`text-[9px] leading-tight ${
          active ? "text-[var(--bg)] opacity-70" : "text-[var(--fg-soft)]"
        }`}
      >
        {sub}
      </span>
    </button>
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
      <div className={`mono ${small ? "text-xs" : "text-base"} font-medium leading-tight`}>
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
