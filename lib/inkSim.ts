import type { PaperParams } from "./paper";
import type { InkParams } from "./paper";
import type { Stroke } from "./types";
import { worldToSim, SIM_SCALE } from "./sheet";

/**
 * Deterministic ink-on-paper renderer.
 *
 * The painted image is a *pure function* of the committed stroke list (plus the
 * single in-progress stroke). Every frame the pigment field is rebuilt from the
 * strokes and composited — so undo, redo and any redraw are pixel-identical by
 * construction. There is no stateful alpha accumulation to drift.
 *
 * Pigment is modelled with subtractive Beer–Lambert optics rather than alpha:
 * accumulated pigment density attenuates the paper colour per channel, so dense
 * / overlapping ink converges to a deep, rich black and coloured ink keeps its
 * hue. Ink darkens as it dries (a deterministic function of stroke age).
 */
export class InkSim {
  readonly w: number;
  readonly h: number;
  private N: number;

  private pig: Float32Array; // accumulated pigment density
  private cr: Float32Array; // premultiplied ink colour (density * channel)
  private cg: Float32Array;
  private cb: Float32Array;
  private grain: Float32Array; // paper tooth 0..1

  private paper!: PaperParams;
  private ink!: InkParams;
  private base: [number, number, number] = [247, 245, 239];

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

  /** Build the (deterministic) paper tooth field. */
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

  /** Drying time for a stroke, in ms. Faster on absorbent paper. */
  private dryTimeMs(): number {
    const base = 600 + (1 - this.ink.drying) * 4200;
    return base * (1.25 - 0.45 * this.paper.absorbency);
  }

  /**
   * Rebuild the pigment field from strokes and composite to ImageData.
   * `now` drives the (deterministic, age-based) drying animation.
   * Returns whether any stroke is still drying (so the loop keeps ticking).
   */
  render(
    strokes: Stroke[],
    live: Stroke[],
    now: number
  ): { image: ImageData; animating: boolean } {
    this.pig.fill(0);
    this.cr.fill(0);
    this.cg.fill(0);
    this.cb.fill(0);

    const dryT = this.dryTimeMs();
    let animating = false;

    for (const s of strokes) {
      const age = now - (s.createdAt ?? 0);
      const dryness = s.createdAt == null ? 1 : clamp01(age / dryT);
      if (dryness < 1) animating = true;
      this.stamp(s, dryness);
    }
    for (const s of live) {
      // in-progress ink is wet
      this.stamp(s, 0);
      animating = true;
    }

    this.composite();
    return { image: this.image, animating };
  }

  /** Accumulate a stroke's pigment into the field at a given dryness (0..1). */
  private stamp(stroke: Stroke, dryness: number) {
    const pts = stroke.points;
    if (pts.length === 0) return;
    const rgb = hexToRGB(stroke.color);

    // wet ink renders lighter; it darkens and spreads as it dries
    const contrast = this.ink.dryingContrast;
    const dryMul = lerp(1 - contrast * 0.7, 1, easeOut(dryness));
    const spreadEase = easeOut(dryness); // bleed grows until dry, then freezes

    // paper + ink driven bleed and edge character
    const spreadFactor =
      (0.18 + 1.5 * this.paper.absorbency * (1 - this.paper.spreadResistance)) *
      (0.45 + 0.85 * stroke.brush.wet);
    const edgeNoise = this.paper.roughness * 0.6 + this.ink.noise * 0.5;
    const seed = hashStr(stroke.id);

    const dabPig = this.ink.pigment * dryMul;

    const stampDab = (wx: number, wy: number, pr: number) => {
      const { sx, sy } = worldToSim(wx, wy);
      const coreR = Math.max(0.7, stroke.brush.size * SIM_SCALE * (0.3 + 0.7 * pr) * 0.5);
      const bleedR = coreR * (1 + spreadFactor * spreadEase) + 0.8;
      this.disc(sx, sy, coreR, bleedR, dabPig * pr, rgb, edgeNoise, seed);
    };

    // march along the polyline at fixed spacing for even density
    let prev = pts[0];
    stampDab(prev.x, prev.y, prev.p);
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const len = Math.hypot(dx, dy);
      const coreR = Math.max(0.7, stroke.brush.size * SIM_SCALE * 0.5 * 0.5);
      const step = Math.max(0.6, coreR * 0.55);
      const n = Math.max(1, Math.floor(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        stampDab(prev.x + dx * t, prev.y + dy * t, prev.p + (cur.p - prev.p) * t);
      }
      prev = cur;
    }
  }

  /** Stamp one soft dab with core, bleed falloff, ragged edge and edge darkening. */
  private disc(
    cx: number,
    cy: number,
    coreR: number,
    bleedR: number,
    amount: number,
    rgb: [number, number, number],
    edgeNoise: number,
    seed: number
  ) {
    const { w, h } = this;
    const x0 = Math.max(0, Math.floor(cx - bleedR));
    const x1 = Math.min(w - 1, Math.ceil(cx + bleedR));
    const y0 = Math.max(0, Math.floor(cy - bleedR));
    const y1 = Math.min(h - 1, Math.ceil(cy + bleedR));
    const coreFrac = Math.min(0.95, coreR / bleedR);
    const edge = this.ink.edge;
    // normalize so tighter dab spacing doesn't over-darken a single pass
    const norm = amount * 0.45;

    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > bleedR) continue;
        const i = row + x;
        // ragged, deterministic edge from value noise
        const wob =
          (valueNoise((x + seed) * 0.5, (y - seed) * 0.5) - 0.5) *
          edgeNoise *
          bleedR *
          0.4;
        const t = (d + wob) / bleedR;
        if (t >= 1) continue;
        let wgt: number;
        if (t <= coreFrac) {
          wgt = 1;
        } else {
          const u = (t - coreFrac) / (1 - coreFrac); // 0..1 across bleed
          wgt = Math.pow(1 - u, 1.6);
          // edge darkening: pigment piles toward the drying rim
          wgt += edge * 0.6 * Math.exp(-((u - 0.78) * (u - 0.78)) / 0.02);
        }
        if (wgt <= 0) continue;
        wgt *= 0.7 + 0.3 * this.grain[i]; // paper tooth catches ink unevenly
        const p = wgt * norm;
        this.pig[i] += p;
        this.cr[i] += p * rgb[0];
        this.cg[i] += p * rgb[1];
        this.cb[i] += p * rgb[2];
      }
    }
  }

  /** Subtractive Beer–Lambert composite — rich blacks, true overlap darkening. */
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
      // average ink hue
      let hr = cr[i] / P;
      let hg = cg[i] / P;
      let hb = cb[i] / P;
      // saturation around luminance
      const lum = 0.299 * hr + 0.587 * hg + 0.114 * hb;
      hr = clamp255(lum + (hr - lum) * sat);
      hg = clamp255(lum + (hg - lum) * sat);
      hb = clamp255(lum + (hb - lum) * sat);
      // per-channel absorbance of the ink (black absorbs all channels)
      const ar = 1 - hr / 255;
      const ag = 1 - hg / 255;
      const ab = 1 - hb / 255;
      const k = K * P;
      // transmittance, deepened by the black point
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
}

// ---- helpers ----
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
