import type { PaperParams, InkParams } from "./paper";
import type { Stroke, BrushStyle } from "./types";
import { worldToSim, SHEET } from "./sheet";

/**
 * Deterministic ink-on-paper renderer with per-brush physics.
 *
 * The painted image is a pure function of the stroke list (+ the in-progress
 * stroke), so undo / redo / redraw are pixel-identical. Pigment accumulates in
 * Float32 fields and is composited with subtractive Beer–Lambert optics, so
 * dense / overlapping ink reaches a deep rich black.
 *
 * Each of the five brushes deposits pigment with fundamentally different stroke
 * generation, pressure response, paper coupling and drying — see the per-brush
 * `stamp*` methods. All randomness is seeded by cell + stroke, never Math.random.
 */

interface BrushPhysics {
  /** dry-time multiplier (marker/pencil fast, ink slow) */
  dryScale: number;
  /** how much lighter the ink is while wet (0 = no wet/dry shift) */
  wetContrast: number;
  /** capillary bleed factor (0 = none) */
  wetSpread: number;
}

const BRUSH: Record<BrushStyle, BrushPhysics> = {
  inkbleed: { dryScale: 1.0, wetContrast: 0.6, wetSpread: 1.0 },
  marker: { dryScale: 0.18, wetContrast: 0.12, wetSpread: 0.05 },
  pencil: { dryScale: 0.02, wetContrast: 0.0, wetSpread: 0.0 },
  calligraphy: { dryScale: 0.45, wetContrast: 0.3, wetSpread: 0.25 },
  rough: { dryScale: 0.22, wetContrast: 0.1, wetSpread: 0.0 },
};

export class InkSim {
  readonly w: number;
  readonly h: number;
  private N: number;

  private pig: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private grain: Float32Array;

  private paper!: PaperParams;
  private ink!: InkParams;
  private base: [number, number, number] = [247, 245, 239];
  private animating = false;

  private image: ImageData;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.N = w * h;
    const f = () => new Float32Array(this.N);
    this.pig = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.grain = f();
    this.image = new ImageData(w, h);
  }

  setInk(ink: InkParams) {
    this.ink = ink;
  }

  setPaper(paper: PaperParams) {
    this.paper = paper;
    this.base = hexToRGB(paper.color);
    const { w, h } = this;
    const scale = Math.max(1.2, paper.grain);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const n =
          0.5 +
          0.5 *
            (fbm(x / scale, y / scale) * 0.7 +
              fbm(x / (scale * 0.4), y / (scale * 0.4)) * 0.3);
        this.grain[i] = 1 - paper.roughness + paper.roughness * n;
      }
    }
  }

  private dryTimeMs(): number {
    const base = 600 + (1 - this.ink.drying) * 4200;
    return base * (1.25 - 0.45 * this.paper.absorbency);
  }

  render(
    strokes: Stroke[],
    live: Stroke[],
    now: number
  ): { image: ImageData; animating: boolean } {
    this.pig.fill(0);
    this.cr.fill(0);
    this.cg.fill(0);
    this.cb.fill(0);
    this.animating = false;

    for (const s of strokes) this.stamp(s, now, false);
    for (const s of live) this.stamp(s, now, true);

    this.composite();
    return { image: this.image, animating: this.animating };
  }

  // ---- pigment writers ----
  private add(i: number, amt: number, rgb: readonly [number, number, number]) {
    if (amt <= 0) return;
    this.pig[i] += amt;
    this.cr[i] += amt * rgb[0];
    this.cg[i] += amt * rgb[1];
    this.cb[i] += amt * rgb[2];
  }

  /** Visit every cell within `maxDist` of segment a→b. cb(i,x,y,perp,t). */
  private capsule(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    maxDist: number,
    cb: (i: number, x: number, y: number, perp: number, t: number) => void
  ) {
    const { w, h } = this;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - maxDist));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + maxDist));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - maxDist));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + maxDist));
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        let t = ((x - ax) * dx + (y - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t;
        const py = ay + dy * t;
        const perp = Math.hypot(x - px, y - py);
        if (perp <= maxDist) cb(row + x, x, y, perp, t);
      }
    }
  }

  // ---- dispatch ----
  private stamp(stroke: Stroke, now: number, isLive: boolean) {
    const phys = BRUSH[stroke.brush.style];
    const dryT = this.dryTimeMs() * phys.dryScale;
    const dryness = isLive
      ? 0
      : stroke.createdAt == null
      ? 1
      : clamp01((now - stroke.createdAt) / dryT);
    if (dryness < 1) this.animating = true;

    switch (stroke.brush.style) {
      case "inkbleed":
        this.stampInk(stroke, dryness, phys);
        break;
      case "marker":
        this.stampMarker(stroke, dryness);
        break;
      case "pencil":
        this.stampPencil(stroke);
        break;
      case "calligraphy":
        this.stampCalligraphy(stroke, dryness);
        break;
      case "rough":
        this.stampRough(stroke);
        break;
    }
  }

  private rgbOf(stroke: Stroke): [number, number, number] {
    return hexToRGB(stroke.color);
  }

  // ---- 1. INK BLEED — liquid India ink: capillary spread, feathered + dark edges ----
  private stampInk(stroke: Stroke, dryness: number, phys: BrushPhysics) {
    const rgb = this.rgbOf(stroke);
    const seed = hashStr(stroke.id);
    const contrast = this.ink.dryingContrast * phys.wetContrast;
    const dryMul = lerp(1 - contrast, 1, easeOut(dryness));
    const spread =
      (0.2 + 1.6 * this.paper.absorbency * (1 - this.paper.spreadResistance)) *
      phys.wetSpread *
      (0.4 + 0.9 * stroke.brush.wet);
    const spreadEase = easeOut(dryness);
    const edge = this.ink.edge;
    const feather = this.paper.roughness * 0.5 + this.ink.noise * 0.6;
    const pts = stroke.points;

    this.eachSegment(stroke, (ax, ay, bx, by, pr) => {
      const coreR =
        Math.max(0.7, stroke.brush.size * SHEET.scale * (0.32 + 0.68 * pr) * 0.5);
      const bleedR = coreR * (1 + spread * spreadEase) + 0.8;
      const coreFrac = Math.min(0.9, coreR / bleedR);
      const amt = this.ink.pigment * dryMul * pr * 0.5;
      this.capsule(ax, ay, bx, by, bleedR, (i, x, y, perp) => {
        const wob =
          (valueNoise((x + seed) * 0.5, (y - seed) * 0.5) - 0.5) *
          feather *
          bleedR *
          0.5;
        const tdist = (perp + wob) / bleedR;
        if (tdist >= 1) return;
        let wgt: number;
        if (tdist <= coreFrac) wgt = 1;
        else {
          const u = (tdist - coreFrac) / (1 - coreFrac);
          wgt = Math.pow(1 - u, 1.5);
          // darker feathered rim — pigment trapped at the drying edge
          wgt += edge * 0.7 * Math.exp(-((u - 0.8) * (u - 0.8)) / 0.02);
        }
        this.add(i, wgt * amt * (0.7 + 0.3 * this.grain[i]), rgb);
      });
    });
    void pts;
  }

  // ---- 2. MARKER — Copic felt-tip: flat saturated, crisp edge, faint streaks ----
  private stampMarker(stroke: Stroke, dryness: number) {
    const rgb = this.rgbOf(stroke);
    const seed = hashStr(stroke.id);
    // translucent single pass so overlapping passes layer/darken (Copic)
    const dryMul = lerp(0.9, 1, dryness);
    this.eachSegment(stroke, (ax, ay, bx, by, pr) => {
      // pressure drives WIDTH far more than opacity
      const halfW = Math.max(0.8, stroke.brush.size * SHEET.scale * (0.28 + 0.72 * pr) * 0.6);
      const amt = this.ink.pigment * 0.9 * dryMul; // near-constant coverage
      this.capsule(ax, ay, bx, by, halfW + 0.6, (i, x, y, perp) => {
        const edge = perp / (halfW + 0.6);
        // crisp felt edge: flat core, short hard falloff
        let wgt = edge < 0.85 ? 1 : Math.max(0, 1 - (edge - 0.85) / 0.15);
        // faint dry-felt streaks along the travel direction
        const streak =
          0.82 + 0.18 * valueNoise((x + seed) * 0.9, (y - seed) * 0.18);
        this.add(i, wgt * amt * streak, rgb);
      });
    });
  }

  // ---- 3. PENCIL — graphite: tooth-gated grain, pressure=darkness, broken gaps ----
  private stampPencil(stroke: Stroke) {
    // graphite reads as a desaturated grey, never a pure black
    const c = hexToRGB(stroke.color);
    const rgb: [number, number, number] = [
      lerp(c[0], 92, 0.55),
      lerp(c[1], 94, 0.55),
      lerp(c[2], 99, 0.55),
    ];
    const seed = hashStr(stroke.id);
    this.eachSegment(stroke, (ax, ay, bx, by, pr, tiltMag) => {
      // tilt -> broad, light shading; upright -> narrow, dark line
      const broad = tiltMag; // 0..1
      const halfW =
        Math.max(0.7, stroke.brush.size * SHEET.scale * 0.42) * (0.5 + 0.5 * pr) *
        (1 + broad * 2.2);
      const dark = (0.25 + 0.75 * pr) * (1 - broad * 0.5);
      const amt = this.ink.pigment * 0.85 * dark;
      // higher pressure presses graphite into more of the tooth (fewer gaps)
      const toothCut = 0.72 - 0.5 * pr - 0.2 * broad;
      this.capsule(ax, ay, bx, by, halfW, (i, x, y, perp) => {
        const edge = perp / halfW;
        if (edge > 1) return;
        const g = this.grain[i];
        if (g < toothCut) return; // skips the paper valleys -> natural gaps
        const particle =
          0.55 + 0.45 * valueNoise((x + seed) * 1.7, (y + seed) * 1.7);
        const fall = 1 - edge * 0.6;
        this.add(i, amt * (g - toothCut) * 2.4 * particle * fall, rgb);
      });
    });
  }

  // ---- 4. CALLIGRAPHY — flat broad nib: width by angle, chiselled ends, corner pooling ----
  private stampCalligraphy(stroke: Stroke, dryness: number) {
    const rgb = this.rgbOf(stroke);
    const nib = stroke.brush.angle;
    const nx = Math.cos(nib);
    const ny = Math.sin(nib);
    const half = Math.max(1.2, stroke.brush.size * SHEET.scale * 0.85); // nib length/2
    const thin = Math.max(0.5, half * 0.16); // nib thickness
    const dryMul = lerp(1 - this.ink.dryingContrast * 0.3, 1, dryness);
    const amt = this.ink.pigment * 0.95 * dryMul;
    this.eachSegment(stroke, (ax, ay, bx, by, pr) => {
      const len = Math.hypot(bx - ax, by - ay) || 1e-6;
      // contact width of a flat nib = projection onto the motion normal
      const dirx = (bx - ax) / len;
      const diry = (by - ay) / len;
      const sinT = Math.abs(dirx * ny - diry * nx); // |sin(motion, nib)|
      const reach = thin + (half - thin) * sinT;
      const w = pr * 0.4 + 0.6; // pressure adds a little weight
      // stamp the oriented flat nib as a thin capsule along the nib axis
      this.capsule(
        ax - nx * reach,
        ay - ny * reach,
        bx + nx * reach,
        by + ny * reach,
        thin + 0.6,
        (i, x, y, perp) => {
          // restrict to the band between the two nib edges (sharp chisel)
          const along =
            (x - ax) * nx + (y - ay) * ny; // distance along nib axis
          if (Math.abs(along) > reach + 0.6) return;
          const e = perp / (thin + 0.6);
          const wgt = e < 0.7 ? 1 : Math.max(0, 1 - (e - 0.7) / 0.3);
          this.add(i, wgt * amt * w, rgb);
        }
      );
    });
  }

  // ---- 5. ROUGH — dry brush: separate bristle tracks, gaps, broken edges ----
  private stampRough(stroke: Stroke) {
    const rgb = this.rgbOf(stroke);
    const seed = hashStr(stroke.id);
    const BRISTLES = 9;
    this.eachSegment(stroke, (ax, ay, bx, by, pr, _t, segT) => {
      const len = Math.hypot(bx - ax, by - ay) || 1e-6;
      const dirx = (bx - ax) / len;
      const diry = (by - ay) / len;
      const px = -diry;
      const py = dirx; // motion normal
      const halfW = Math.max(1, stroke.brush.size * SHEET.scale * (0.4 + 0.6 * pr) * 0.6);
      const amt = this.ink.pigment * 0.85;
      // fewer bristles make contact at low pressure -> more broken
      const contact = 0.35 + 0.65 * pr;
      for (let b = 0; b < BRISTLES; b++) {
        // each bristle's lateral position + whether it touches the paper here
        const off = ((b + 0.5) / BRISTLES - 0.5) * 2 * halfW;
        const exist = valueNoise(b * 7.3 + seed, segT * 3.1 + b);
        if (exist > contact) continue; // this bristle lifts off -> missing pigment
        const oax = ax + px * off;
        const oay = ay + py * off;
        const obx = bx + px * off;
        const oby = by + py * off;
        const bw = 0.55 + 0.5 * valueNoise(b * 3.1, seed + b);
        this.capsule(oax, oay, obx, oby, bw, (i, x, y, perp) => {
          // along-stroke dry gaps
          const gap = valueNoise((x + seed) * 0.7, (y - seed) * 0.7);
          if (gap < 0.32) return;
          const e = perp / bw;
          const wgt = (1 - e) * (0.5 + 0.5 * this.grain[i]);
          this.add(i, wgt * amt * (gap - 0.32) * 1.5, rgb);
        });
      }
    });
  }

  /** March a stroke's polyline, invoking cb per sub-segment with interpolated pressure + tilt. */
  private eachSegment(
    stroke: Stroke,
    cb: (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      pressure: number,
      tiltMag: number,
      segT: number
    ) => void
  ) {
    const pts = stroke.points;
    if (pts.length === 0) return;
    const r0 = Math.max(0.7, stroke.brush.size * SHEET.scale * 0.5);
    const step = Math.max(0.8, r0 * 0.8);
    if (pts.length === 1) {
      const a = worldToSim(pts[0].x, pts[0].y);
      cb(a.sx, a.sy, a.sx + 0.01, a.sy, pts[0].p, tiltMag(pts[0]), 0);
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const a = worldToSim(p0.x, p0.y);
      const b = worldToSim(p1.x, p1.y);
      const len = Math.hypot(b.sx - a.sx, b.sy - a.sy);
      const n = Math.max(1, Math.floor(len / step));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const ax = a.sx + (b.sx - a.sx) * t0;
        const ay = a.sy + (b.sy - a.sy) * t0;
        const bx = a.sx + (b.sx - a.sx) * t1;
        const by = a.sy + (b.sy - a.sy) * t1;
        const pr = p0.p + (p1.p - p0.p) * t0;
        const tm = lerp(tiltMag(p0), tiltMag(p1), t0);
        cb(ax, ay, bx, by, pr, tm, (i - 1 + t0) / (pts.length - 1));
      }
    }
  }

  /** Subtractive Beer–Lambert composite. */
  private composite() {
    const { N, base } = this;
    const data = this.image.data;
    const { pig, cr, cg, cb, grain } = this;
    const density = this.ink.density;
    const darkness = this.ink.darkness;
    const sat = this.ink.saturation;
    const blackPoint = this.ink.blackPoint;
    const K = 4.5 * (0.4 + density) * (1 + darkness * 1.6);
    const bpExp = 1 + blackPoint * 2.4;

    for (let i = 0; i < N; i++) {
      const g = grain[i] || 1;
      const pr = base[0] * (0.94 + 0.06 * g);
      const pg = base[1] * (0.94 + 0.06 * g);
      const pb = base[2] * (0.94 + 0.06 * g);
      const o = i * 4;
      const P = pig[i];
      if (P < 1e-4) {
        data[o] = pr;
        data[o + 1] = pg;
        data[o + 2] = pb;
        data[o + 3] = 255;
        continue;
      }
      let hr = cr[i] / P;
      let hg = cg[i] / P;
      let hb = cb[i] / P;
      const lum = 0.299 * hr + 0.587 * hg + 0.114 * hb;
      hr = clamp255(lum + (hr - lum) * sat);
      hg = clamp255(lum + (hg - lum) * sat);
      hb = clamp255(lum + (hb - lum) * sat);
      const ar = 1 - hr / 255;
      const ag = 1 - hg / 255;
      const ab = 1 - hb / 255;
      const k = K * P;
      const Tr = Math.pow(Math.exp(-k * ar), bpExp);
      const Tg = Math.pow(Math.exp(-k * ag), bpExp);
      const Tb = Math.pow(Math.exp(-k * ab), bpExp);
      data[o] = pr * Tr;
      data[o + 1] = pg * Tg;
      data[o + 2] = pb * Tb;
      data[o + 3] = 255;
    }
  }

  hasInk(strokes: Stroke[]): boolean {
    return strokes.length > 0;
  }

  /**
   * Per-cell ink coverage (0..1) + pigment-weighted dominant ink colour,
   * derived with the same Beer–Lambert response used on screen. This is the
   * field the Faithful Ink Export traces, so the SVG matches the canvas.
   */
  coverage(): {
    cov: Float32Array;
    color: [number, number, number];
    w: number;
    h: number;
  } {
    const { N, pig, cr, cg, cb } = this;
    const cov = new Float32Array(N);
    const K = 4.5 * (0.4 + this.ink.density) * (1 + this.ink.darkness * 1.6);
    const bpExp = 1 + this.ink.blackPoint * 2.4;
    let sr = 0,
      sg = 0,
      sb = 0,
      sp = 0;
    for (let i = 0; i < N; i++) {
      const P = pig[i];
      if (P < 1e-4) continue;
      const hr = cr[i] / P;
      const hg = cg[i] / P;
      const hb = cb[i] / P;
      const k = K * P;
      const Tr = Math.pow(Math.exp(-k * (1 - hr / 255)), bpExp);
      const Tg = Math.pow(Math.exp(-k * (1 - hg / 255)), bpExp);
      const Tb = Math.pow(Math.exp(-k * (1 - hb / 255)), bpExp);
      cov[i] = 1 - (0.299 * Tr + 0.587 * Tg + 0.114 * Tb);
      sr += cr[i];
      sg += cg[i];
      sb += cb[i];
      sp += P;
    }
    const color: [number, number, number] =
      sp > 0 ? [sr / sp, sg / sp, sb / sp] : [10, 10, 10];
    return { cov, color, w: this.w, h: this.h };
  }
}

/** Render strokes into a fresh, fully-dried field — used by exporters. */
export function renderDryField(
  simW: number,
  simH: number,
  paper: PaperParams,
  ink: InkParams,
  strokes: Stroke[]
): InkSim {
  const sim = new InkSim(simW, simH);
  sim.setPaper(paper);
  sim.setInk(ink);
  sim.render(strokes, [], 1e15); // huge `now` => everything dry
  return sim;
}

// ---- helpers ----
function tiltMag(p: { tx?: number; ty?: number }): number {
  return Math.min(1, Math.hypot(p.tx ?? 0, p.ty ?? 0));
}
function hexToRGB(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(v || "f7f5ef", 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 997;
}
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x: number, y: number): number {
  let f = 0,
    amp = 0.5,
    freq = 1;
  for (let o = 0; o < 3; o++) {
    f += amp * valueNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return f;
}
