import type { Stroke, VectorPath } from "./types";
import type { ModeProfile } from "./modes";
import {
  type Vec,
  stabilize,
  resample,
  rdp,
  chaikin,
  normal,
  seededNoise,
  dist,
} from "./geometry";

/** Per-brush vectorization character, so each tool traces differently. */
interface VecProfile {
  /** baseline half-width multiplier */
  width: number;
  /** how much pen pressure modulates width (0 = uniform) */
  press: number;
  /** broad-nib angle width model */
  nib: boolean;
  /** edge-irregularity multiplier (graphite/dry = ragged, marker = clean) */
  rough: number;
  /** end-taper multiplier (marker blunt, ink/calligraphy pointed) */
  taper: number;
  /** extra simplification (×) — pencil keeps more anchors */
  simplify: number;
}

const VEC: Record<string, VecProfile> = {
  inkbleed: { width: 1.0, press: 0.7, nib: false, rough: 1.0, taper: 1.0, simplify: 1.0 },
  marker: { width: 0.96, press: 0.45, nib: false, rough: 0.2, taper: 0.15, simplify: 1.2 },
  pencil: { width: 0.62, press: 0.55, nib: false, rough: 1.9, taper: 0.6, simplify: 0.6 },
  calligraphy: { width: 0.9, press: 0.25, nib: true, rough: 0.35, taper: 0.8, simplify: 1.1 },
  rough: { width: 1.05, press: 0.6, nib: false, rough: 2.4, taper: 0.25, simplify: 0.8 },
};

/**
 * Build a variable-width outline polygon for a single stroke. Each brush has its
 * own width model, edge roughness, taper and anchor density (see VEC), so the
 * vector output is as distinguishable as the rendered ink.
 */
function strokeOutline(stroke: Stroke, mode: ModeProfile): Vec[] {
  const vp = VEC[stroke.brush.style] ?? VEC.inkbleed;
  const smoothed = stabilize(stroke.points, stroke.brush.stability * 0.6);
  const spacing = Math.max(2, stroke.brush.size * 0.35);
  const pts = resample(smoothed, spacing);
  if (pts.length < 2) {
    const c = pts[0] ?? stroke.points[0];
    if (!c) return [];
    const r = stroke.brush.size * 0.5 * mode.widthBoost * vp.width;
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    });
  }

  const n = pts.length;
  const left: Vec[] = [];
  const right: Vec[] = [];
  const taper = mode.taper * vp.taper;

  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const nm = normal(prev, next);

    const tEnd = Math.min(i, n - 1 - i) / Math.max(1, (n - 1) / 2);
    const taperAmt = 1 - taper * (1 - Math.min(1, tEnd));

    const pressW = 1 - vp.press + vp.press * (0.4 + pts[i].p);
    let w = stroke.brush.size * 0.5 * mode.widthBoost * vp.width * pressW * taperAmt;

    if (vp.nib) {
      // broad-nib: thin parallel to the nib, thick across it
      const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
      const nibFac = Math.abs(Math.sin(ang - stroke.brush.angle));
      w *= 0.18 + 1.3 * nibFac;
    }

    // retained imperfection — deterministic, scaled by per-brush roughness
    const noiseAmt =
      stroke.brush.bleed *
      mode.roughness *
      vp.rough *
      Math.min(8, stroke.brush.size * 0.5);
    const ln = seededNoise(i * 1.3 + stroke.id.length) * noiseAmt;
    const rn = seededNoise(i * 2.7 + stroke.id.length * 3) * noiseAmt;

    left.push({ x: pts[i].x + nm.x * (w + ln), y: pts[i].y + nm.y * (w + ln) });
    right.push({ x: pts[i].x - nm.x * (w + rn), y: pts[i].y - nm.y * (w + rn) });
  }

  let outline = left.concat(right.reverse());
  if (mode.chaikin > 0) outline = chaikin(outline, mode.chaikin);
  const eps = Math.max(0.4, stroke.brush.size * 0.06 * mode.simplify * vp.simplify);
  outline = rdp(outline, eps);
  return outline;
}

/** Catmull-Rom -> cubic Bézier "d" for a closed loop. Optimized, low-anchor. */
function closedBezierPath(points: Vec[]): string {
  const p = points.filter(
    (pt, i, arr) => i === 0 || dist(pt, arr[i - 1]) > 0.01
  );
  const n = p.length;
  if (n < 3) return "";
  let d = `M ${fmt(p[0].x)} ${fmt(p[0].y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(
      p2.y
    )} `;
  }
  return d + "Z";
}

const fmt = (v: number) => Math.round(v * 100) / 100;

export interface VectorResult {
  paths: VectorPath[];
  anchors: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
}

/** Convert all strokes into clean, mode-interpreted vector paths. */
export function vectorize(
  strokes: Stroke[],
  mode: ModeProfile,
  fillOverride?: string
): VectorResult {
  const paths: VectorPath[] = [];
  let anchors = 0;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const stroke of strokes) {
    const outline = strokeOutline(stroke, mode);
    if (outline.length < 3) continue;
    const d = closedBezierPath(outline);
    if (!d) continue;
    for (const pt of outline) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    anchors += outline.length;
    paths.push({
      id: stroke.id,
      d,
      fill: fillOverride ?? (mode.mono ? "currentColor" : stroke.color),
      anchors: outline.length,
      closed: true,
    });
  }

  const bbox =
    minX === Infinity
      ? null
      : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  return { paths, anchors, bbox };
}

/** Serialize a VectorResult to a standalone, production-ready SVG document. */
export function toSVG(
  result: VectorResult,
  opts: { color: string; pad?: number; background?: string | null } = {
    color: "#0a0a0a",
  }
): string {
  const pad = opts.pad ?? 40;
  const b = result.bbox ?? { x: 0, y: 0, w: 100, h: 100 };
  const w = Math.max(1, b.w + pad * 2);
  const h = Math.max(1, b.h + pad * 2);
  const ox = pad - b.x;
  const oy = pad - b.y;
  const bg = opts.background
    ? `<rect width="${fmt(w)}" height="${fmt(h)}" fill="${opts.background}"/>`
    : "";
  const body = result.paths
    .map((p) => {
      const fill = p.fill === "currentColor" ? opts.color : p.fill;
      return `<path d="${p.d}" fill="${fill}" fill-rule="nonzero"/>`;
    })
    .join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(
    w
  )}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(
    h
  )}">
  ${bg}
  <g transform="translate(${fmt(ox)} ${fmt(oy)})">
    ${body}
  </g>
</svg>`;
}
