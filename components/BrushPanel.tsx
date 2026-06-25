"use client";

import { useStudio } from "@/lib/store";
import type { BrushStyle } from "@/lib/types";

const STYLES: { id: BrushStyle; label: string; hint: string }[] = [
  { id: "inkbleed", label: "Ink Bleed", hint: "Spreading ink, organic edges" },
  { id: "marker", label: "Marker", hint: "Flat, saturated, semi-dry" },
  { id: "pencil", label: "Pencil", hint: "Grainy graphite texture" },
  { id: "calligraphy", label: "Calligraphy", hint: "Broad-nib angle weight" },
  { id: "rough", label: "Rough Brush", hint: "Broken, scratchy strokes" },
];

const SWATCHES = [
  "#0a0a0a",
  "#ff4d2e",
  "#1d4ed8",
  "#0f766e",
  "#b91c1c",
  "#7c3aed",
  "#a16207",
  "#f5f5f0",
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--fg-soft)]">
          {label}
        </span>
        <span className="mono text-[11px] text-[var(--fg)]">
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default function BrushPanel() {
  const brush = useStudio((s) => s.brush);
  const setBrush = useStudio((s) => s.setBrush);
  const setBrushStyle = useStudio((s) => s.setBrushStyle);
  const color = useStudio((s) => s.color);
  const setColor = useStudio((s) => s.setColor);
  const grid = useStudio((s) => s.grid);
  const setGrid = useStudio((s) => s.setGrid);
  const symmetry = useStudio((s) => s.symmetry);
  const setSymmetry = useStudio((s) => s.setSymmetry);

  return (
    <div className="flex flex-col gap-5 p-4">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Brush Engine
        </h3>
        <div className="grid grid-cols-1 gap-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setBrushStyle(s.id)}
              className={`btn flex flex-col items-start rounded-md px-3 py-2 text-left ${
                brush.style === s.id ? "btn-active" : ""
              }`}
            >
              <span className="text-sm font-medium">{s.label}</span>
              <span
                className={`text-[10px] ${
                  brush.style === s.id
                    ? "text-[var(--bg)] opacity-70"
                    : "text-[var(--fg-soft)]"
                }`}
              >
                {s.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Slider
          label="Size"
          value={brush.size}
          min={2}
          max={120}
          step={1}
          onChange={(v) => setBrush({ size: v })}
          fmt={(v) => `${v.toFixed(0)}px`}
        />
        <Slider
          label="Stabilization"
          value={brush.stability}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setBrush({ stability: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Pressure"
          value={brush.pressure}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setBrush({ pressure: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Ink Bleed"
          value={brush.bleed}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setBrush({ bleed: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Opacity"
          value={brush.opacity}
          min={0.1}
          max={1}
          step={0.01}
          onChange={(v) => setBrush({ opacity: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Ink Color
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full border"
              style={{
                background: c,
                borderColor:
                  color === c ? "var(--accent)" : "var(--line)",
                boxShadow: color === c ? "0 0 0 2px var(--accent)" : "none",
              }}
              title={c}
            />
          ))}
          <label
            className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border hairline"
            title="Custom color"
          >
            <span
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t pt-4 hairline">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Guides & Symmetry
        </h3>
        <Slider
          label="Grid size"
          value={grid.size}
          min={8}
          max={120}
          step={2}
          onChange={(v) => setGrid({ size: v })}
          fmt={(v) => `${v.toFixed(0)}px`}
        />
        <label className="flex items-center justify-between text-sm">
          <span>Snap to grid</span>
          <input
            type="checkbox"
            checked={grid.snap}
            onChange={(e) => setGrid({ snap: e.target.checked })}
          />
        </label>
        <Slider
          label="Symmetry axes"
          value={symmetry.axes}
          min={1}
          max={12}
          step={1}
          onChange={(v) => setSymmetry({ axes: v })}
          fmt={(v) => `${v}`}
        />
        <label className="flex items-center justify-between text-sm">
          <span>Mirror reflection</span>
          <input
            type="checkbox"
            checked={symmetry.mirror}
            onChange={(e) => setSymmetry({ mirror: e.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
