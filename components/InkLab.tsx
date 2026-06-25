"use client";

import { useStudio } from "@/lib/store";
import { PAPERS } from "@/lib/paper";

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
        <span className="mono text-[11px]">{fmt ? fmt(value) : value}</span>
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

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function InkLab() {
  const simEnabled = useStudio((s) => s.simEnabled);
  const toggleSim = useStudio((s) => s.toggleSim);
  const paperId = useStudio((s) => s.paperId);
  const setPaperPreset = useStudio((s) => s.setPaperPreset);
  const paper = useStudio((s) => s.paper);
  const setPaperParam = useStudio((s) => s.setPaperParam);
  const ink = useStudio((s) => s.ink);
  const setInkParam = useStudio((s) => s.setInkParam);
  const brush = useStudio((s) => s.brush);
  const setBrush = useStudio((s) => s.setBrush);

  return (
    <div className="flex flex-col gap-5 p-4">
      <label className="flex items-center justify-between rounded-md border px-3 py-2 hairline">
        <div>
          <div className="text-sm font-medium">Ink Physics</div>
          <div className="text-[10px] text-[var(--fg-soft)]">
            Real fibre absorption &amp; drying
          </div>
        </div>
        <input
          type="checkbox"
          checked={simEnabled}
          onChange={toggleSim}
          className="h-4 w-4"
        />
      </label>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Paper Substrate
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {PAPERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPaperPreset(p.id)}
              title={p.blurb}
              className={`btn rounded-md px-2 py-2 text-left text-xs ${
                paperId === p.id ? "btn-active" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Paper Properties
        </h3>
        <Slider
          label="Absorbency"
          value={paper.absorbency}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setPaperParam({ absorbency: v })}
          fmt={pct}
        />
        <Slider
          label="Roughness"
          value={paper.roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setPaperParam({ roughness: v })}
          fmt={pct}
        />
        <Slider
          label="Grain scale"
          value={paper.grain}
          min={1}
          max={10}
          step={0.1}
          onChange={(v) => setPaperParam({ grain: v })}
          fmt={(v) => v.toFixed(1)}
        />
        <Slider
          label="Density"
          value={paper.density}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setPaperParam({ density: v })}
          fmt={pct}
        />
        <Slider
          label="Fibre direction"
          value={paper.fiberAngle}
          min={0}
          max={Math.PI}
          step={0.01}
          onChange={(v) => setPaperParam({ fiberAngle: v })}
          fmt={(v) => `${Math.round((v * 180) / Math.PI)}°`}
        />
        <Slider
          label="Fibre strength"
          value={paper.fiberStrength}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setPaperParam({ fiberStrength: v })}
          fmt={pct}
        />
        <Slider
          label="Wetness (pre-soak)"
          value={paper.wetness}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(v) => setPaperParam({ wetness: v })}
          fmt={pct}
        />
        <Slider
          label="Spread resistance"
          value={paper.spreadResistance}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setPaperParam({ spreadResistance: v })}
          fmt={pct}
        />
      </section>

      <section className="flex flex-col gap-3 border-t pt-4 hairline">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Ink Material
        </h3>
        <Slider
          label="Viscosity"
          value={ink.viscosity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ viscosity: v })}
          fmt={pct}
        />
        <Slider
          label="Pigment concentration"
          value={ink.pigment}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ pigment: v })}
          fmt={pct}
        />
        <Slider
          label="Absorption rate"
          value={ink.absorption}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ absorption: v })}
          fmt={pct}
        />
        <Slider
          label="Edge darkening"
          value={ink.edge}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ edge: v })}
          fmt={pct}
        />
        <Slider
          label="Flow noise"
          value={ink.noise}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ noise: v })}
          fmt={pct}
        />
      </section>

      <section className="flex flex-col gap-3 border-t pt-4 hairline">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-soft)]">
          Drying Engine
        </h3>
        <Slider
          label="Drying speed"
          value={ink.drying}
          min={0.02}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ drying: v })}
          fmt={pct}
        />
        <Slider
          label="Evaporation"
          value={ink.evaporation}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setInkParam({ evaporation: v })}
          fmt={pct}
        />
        <Slider
          label="Brush water load"
          value={brush.wet}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => setBrush({ wet: v })}
          fmt={pct}
        />
      </section>

      <p className="text-[10px] leading-relaxed text-[var(--fg-soft)]">
        Every change updates the wet canvas instantly. Ink keeps spreading,
        settling into the fibres and drying after you lift the brush — wet-on-wet
        when the sheet is damp, wet-on-dry over cured ink.
      </p>
    </div>
  );
}
