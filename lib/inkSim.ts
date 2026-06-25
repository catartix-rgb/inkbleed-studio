import type { PaperParams, InkParams } from "./paper";

/**
 * Grid-based ink-on-paper fluid simulation.
 *
 * The sheet is a fixed paper substrate. Each cell tracks free surface water,
 * suspended pigment (with colour), and pigment that has dried into the fibres.
 * Per tick we:
 *   1. level + wick water across cells (capillary action, fibre anisotropy)
 *   2. advect suspended pigment with the water flow (bleeding / feathering)
 *   3. soak water into the paper, fixing pigment (uneven absorption)
 *   4. accumulate extra pigment at the drying rim (edge darkening / backruns)
 *   5. evaporate water (drying); when dry, remaining pigment fixes (pooling)
 *
 * Ink keeps evolving after the stroke ends until the sheet is dry — a real
 * material response rather than a scaled brush texture.
 */
export class InkSim {
  readonly w: number;
  readonly h: number;
  private N: number;

  // surface (wet) layer
  private water: Float32Array;
  private pig: Float32Array; // suspended pigment amount
  private cr: Float32Array; // premultiplied suspended colour (amount*channel)
  private cg: Float32Array;
  private cb: Float32Array;
  // fixed (dried) layer
  private dep: Float32Array; // deposited pigment amount
  private dcr: Float32Array;
  private dcg: Float32Array;
  private dcb: Float32Array;
  // paper
  private capacity: Float32Array;
  private grain: Float32Array;
  // scratch
  private nWater: Float32Array;
  private nPig: Float32Array;
  private nCr: Float32Array;
  private nCg: Float32Array;
  private nCb: Float32Array;

  private paper!: PaperParams;
  private ink!: InkParams;

  // active dirty region to keep idle cost near zero
  private aMinX = 0;
  private aMinY = 0;
  private aMaxX = 0;
  private aMaxY = 0;
  private active = false;

  private image: ImageData;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.N = w * h;
    const f = () => new Float32Array(this.N);
    this.water = f();
    this.pig = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.dep = f();
    this.dcr = f();
    this.dcg = f();
    this.dcb = f();
    this.capacity = f();
    this.grain = f();
    this.nWater = f();
    this.nPig = f();
    this.nCr = f();
    this.nCg = f();
    this.nCb = f();
    this.image = new ImageData(w, h);
  }

  get isActive() {
    return this.active;
  }

  setInk(ink: InkParams) {
    this.ink = ink;
  }

  /** (Re)build the paper substrate fields from paper params. */
  setPaper(paper: PaperParams) {
    this.paper = paper;
    const { w, h } = this;
    const scale = Math.max(1.2, paper.grain);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // layered value noise for paper tooth
        const n =
          0.5 +
          0.5 *
            (fbm(x / scale, y / scale) * 0.7 +
              fbm(x / (scale * 0.4), y / (scale * 0.4)) * 0.3);
        const tooth = 1 - paper.roughness + paper.roughness * n;
        this.grain[i] = tooth;
        // absorbent papers hold more before saturating; denser papers hold less
        this.capacity[i] =
          (0.5 + paper.absorbency * 1.5) * (1.3 - paper.density) * (0.6 + 0.8 * tooth);
        // pre-wet the sheet for wet-on-wet grounds
        if (paper.wetness > 0) {
          this.water[i] = paper.wetness * 0.5 * tooth;
        }
      }
    }
    if (paper.wetness > 0) this.markAll();
  }

  /** Wet ink deposit along a brush dab. amounts scaled by brush + pressure. */
  deposit(
    cx: number,
    cy: number,
    radius: number,
    pressure: number,
    rgb: [number, number, number],
    opts: { water: number; pigment: number; noise: number }
  ) {
    const { w, h } = this;
    const r = Math.max(0.8, radius);
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const pigStrength = this.ink.pigment * opts.pigment;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const i = y * w + x;
        let fall = 1 - d / r;
        fall *= fall; // soft core
        // grain + noise break the deposit up (dry-media / rough feel)
        const grainMod =
          1 - opts.noise * this.ink.noise * (1 - this.grain[i]) * 1.4;
        const jitter = 1 - opts.noise * this.ink.noise * Math.random() * 0.8;
        const amt = fall * pressure * Math.max(0, grainMod) * jitter;
        if (amt <= 0) continue;
        this.water[i] = Math.min(2.2, this.water[i] + amt * opts.water * 0.9);
        const p = amt * pigStrength;
        this.pig[i] += p;
        this.cr[i] += p * rgb[0];
        this.cg[i] += p * rgb[1];
        this.cb[i] += p * rgb[2];
      }
    }
    this.mark(x0, y0, x1, y1);
  }

  /** Instantly stamp a dry mark (used when rebuilding after undo). */
  stampDry(
    cx: number,
    cy: number,
    radius: number,
    pressure: number,
    rgb: [number, number, number]
  ) {
    const { w, h } = this;
    const r = Math.max(0.8, radius);
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const i = y * w + x;
        let fall = 1 - d / r;
        fall = Math.min(1, fall * 1.6);
        const amt = fall * pressure * (this.ink?.pigment ?? 0.7);
        this.dep[i] += amt;
        this.dcr[i] += amt * rgb[0];
        this.dcg[i] += amt * rgb[1];
        this.dcb[i] += amt * rgb[2];
      }
    }
  }

  /** Clear everything (keeps paper substrate). */
  reset() {
    this.water.fill(0);
    this.pig.fill(0);
    this.cr.fill(0);
    this.cg.fill(0);
    this.cb.fill(0);
    this.dep.fill(0);
    this.dcr.fill(0);
    this.dcg.fill(0);
    this.dcb.fill(0);
    if (this.paper?.wetness) this.setPaper(this.paper);
    this.active = false;
  }

  private mark(x0: number, y0: number, x1: number, y1: number) {
    if (!this.active) {
      this.aMinX = x0;
      this.aMinY = y0;
      this.aMaxX = x1;
      this.aMaxY = y1;
      this.active = true;
    } else {
      this.aMinX = Math.min(this.aMinX, x0);
      this.aMinY = Math.min(this.aMinY, y0);
      this.aMaxX = Math.max(this.aMaxX, x1);
      this.aMaxY = Math.max(this.aMaxY, y1);
    }
  }

  private markAll() {
    this.mark(0, 0, this.w - 1, this.h - 1);
  }

  /** Advance the simulation by one tick. Returns true while still evolving. */
  step(): boolean {
    if (!this.active || !this.ink || !this.paper) return false;
    const { w, h } = this;
    // grow active region by 1 to let the wet front advance
    const minX = Math.max(1, this.aMinX - 1);
    const minY = Math.max(1, this.aMinY - 1);
    const maxX = Math.min(w - 2, this.aMaxX + 1);
    const maxY = Math.min(h - 2, this.aMaxY + 1);

    const visc = 1 - this.ink.viscosity * 0.85;
    const resist = 1 - this.paper.spreadResistance * 0.9;
    const D = 0.16 * visc * resist; // surface levelling
    const CAP = 0.09 * visc * resist * (0.3 + this.paper.absorbency); // capillary pull
    const fa = this.paper.fiberAngle;
    const fs = this.paper.fiberStrength;
    // fibre flow multipliers for the 4 axes
    const fH = 1 + fs * Math.abs(Math.cos(fa));
    const fV = 1 + fs * Math.abs(Math.sin(fa));

    const { water, pig, cr, cg, cb, capacity, dep } = this;
    const nWater = this.nWater;
    const nPig = this.nPig;
    const nCr = this.nCr;
    const nCg = this.nCg;
    const nCb = this.nCb;

    // initialise scratch = current (only across active band + margin)
    for (let y = minY - 1; y <= maxY + 1; y++) {
      const row = y * w;
      for (let x = minX - 1; x <= maxX + 1; x++) {
        const i = row + x;
        nWater[i] = water[i];
        nPig[i] = pig[i];
        nCr[i] = cr[i];
        nCg[i] = cg[i];
        nCb[i] = cb[i];
      }
    }

    let nMinX = w,
      nMinY = h,
      nMaxX = 0,
      nMaxY = 0,
      anyWet = false;

    const noiseAmt = this.ink.noise * 0.5;

    for (let y = minY; y <= maxY; y++) {
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const i = row + x;
        const wv = water[i];
        if (wv < 1e-3) continue;

        const idxN = i - w,
          idxS = i + w,
          idxE = i + 1,
          idxW = i - 1;
        // outflow to each neighbour: surface levelling + capillary wicking
        const fl = (ni: number, axis: number) => {
          const head = wv - water[ni];
          const thirst = Math.max(0, capacity[ni] - dep[ni] - water[ni] - pig[ni]);
          let f = D * Math.max(0, head) * axis + CAP * thirst * axis;
          if (noiseAmt) f *= 1 - noiseAmt + noiseAmt * Math.random();
          return f < 0 ? 0 : f;
        };
        let fN = fl(idxN, fV);
        let fS = fl(idxS, fV);
        let fE = fl(idxE, fH);
        let fW = fl(idxW, fH);

        let tot = fN + fS + fE + fW;
        if (tot <= 1e-6) continue;
        // never move more than ~half the water out in one tick (stability)
        const cap = wv * 0.5;
        if (tot > cap) {
          const s = cap / tot;
          fN *= s;
          fS *= s;
          fE *= s;
          fW *= s;
          tot = cap;
        }
        const frac = tot / wv; // fraction of water (and pigment) leaving
        const pOut = pig[i] * frac;
        const rOut = cr[i] * frac;
        const gOut = cg[i] * frac;
        const bOut = cb[i] * frac;

        nWater[i] -= tot;
        nPig[i] -= pOut;
        nCr[i] -= rOut;
        nCg[i] -= gOut;
        nCb[i] -= bOut;

        const give = (ni: number, f: number) => {
          const sh = f / tot;
          nWater[ni] += f;
          nPig[ni] += pOut * sh;
          nCr[ni] += rOut * sh;
          nCg[ni] += gOut * sh;
          nCb[ni] += bOut * sh;
        };
        give(idxN, fN);
        give(idxS, fS);
        give(idxE, fE);
        give(idxW, fW);
      }
    }

    // absorption + edge darkening + drying on the new buffers
    const absorb = this.ink.absorption * (0.2 + this.paper.absorbency);
    const dry = this.ink.drying * (0.4 + this.ink.evaporation) * 0.06 + 0.004;
    const edge = this.ink.edge;

    for (let y = minY - 1; y <= maxY + 1; y++) {
      const row = y * w;
      for (let x = minX - 1; x <= maxX + 1; x++) {
        const i = row + x;
        let wv = nWater[i];
        if (wv < 1e-4 && nPig[i] < 1e-4) {
          nWater[i] = 0;
          continue;
        }

        // rim detection: drier neighbours => drying edge => pigment piles up
        const dryRim =
          (water[i - 1] < wv ? 1 : 0) +
          (water[i + 1] < wv ? 1 : 0) +
          (water[i - w] < wv ? 1 : 0) +
          (water[i + w] < wv ? 1 : 0);

        // soak water into paper, fixing a share of suspended pigment
        const grabFrac = Math.min(0.9, absorb * 0.12 * (1 + 0.5 * dryRim * edge));
        const soak = wv * absorb * 0.08;
        wv = Math.max(0, wv - soak);

        if (nPig[i] > 1e-5) {
          const fix = nPig[i] * grabFrac;
          this.dep[i] += fix;
          const inv = nPig[i] > 1e-6 ? fix / nPig[i] : 0;
          this.dcr[i] += nCr[i] * inv;
          this.dcg[i] += nCg[i] * inv;
          this.dcb[i] += nCb[i] * inv;
          nPig[i] -= fix;
          nCr[i] -= nCr[i] * inv;
          nCg[i] -= nCg[i] * inv;
          nCb[i] -= nCb[i] * inv;
        }

        // evaporate
        wv = Math.max(0, wv - dry);
        if (wv < 6e-3) {
          // dries out: dump remaining pigment into the fibres (pooling/stain)
          this.dep[i] += nPig[i];
          this.dcr[i] += nCr[i];
          this.dcg[i] += nCg[i];
          this.dcb[i] += nCb[i];
          nPig[i] = 0;
          nCr[i] = 0;
          nCg[i] = 0;
          nCb[i] = 0;
          wv = 0;
        }
        nWater[i] = wv;

        if (wv > 1e-3) {
          anyWet = true;
          if (x < nMinX) nMinX = x;
          if (y < nMinY) nMinY = y;
          if (x > nMaxX) nMaxX = x;
          if (y > nMaxY) nMaxY = y;
        }
      }
    }

    // commit scratch -> state (active band)
    for (let y = minY - 1; y <= maxY + 1; y++) {
      const row = y * w;
      for (let x = minX - 1; x <= maxX + 1; x++) {
        const i = row + x;
        water[i] = nWater[i];
        pig[i] = nPig[i];
        cr[i] = nCr[i];
        cg[i] = nCg[i];
        cb[i] = nCb[i];
      }
    }

    if (!anyWet) {
      this.active = false;
      return false;
    }
    this.aMinX = nMinX;
    this.aMinY = nMinY;
    this.aMaxX = nMaxX;
    this.aMaxY = nMaxY;
    return true;
  }

  /** Render paper + ink into the internal ImageData and return it. */
  render(): ImageData {
    const { w, h, N } = this;
    const data = this.image.data;
    const base = hexToRGB(this.paper?.color ?? "#f7f5ef");
    const { dep, dcr, dcg, dcb, pig, cr, cg, cb, water, grain } = this;
    for (let i = 0; i < N; i++) {
      const g = grain[i] || 1;
      // paper tooth shading
      let pr = base[0] * (0.93 + 0.07 * g);
      let pg = base[1] * (0.93 + 0.07 * g);
      let pb = base[2] * (0.93 + 0.07 * g);

      const dAmt = dep[i];
      const sAmt = pig[i];
      const total = dAmt + sAmt;
      if (total > 1e-4) {
        // ink colour = weighted average of dried + suspended pigment
        const rr = (dcr[i] + cr[i]) / total;
        const gg = (dcg[i] + cg[i]) / total;
        const bb = (dcb[i] + cb[i]) / total;
        // density -> coverage; suspended pigment looks slightly lighter (wet)
        const dryCov = 1 - Math.exp(-2.6 * dAmt);
        const wetCov = (1 - Math.exp(-2.2 * sAmt)) * 0.85;
        const cov = Math.min(1, dryCov + wetCov);
        pr = pr * (1 - cov) + rr * cov;
        pg = pg * (1 - cov) + gg * cov;
        pb = pb * (1 - cov) + bb * cov;
        // wet sheen: darken slightly where standing water remains
        const wet = Math.min(1, water[i]);
        const sh = 1 - wet * 0.12;
        pr *= sh;
        pg *= sh;
        pb *= sh;
      }
      const o = i * 4;
      data[o] = pr;
      data[o + 1] = pg;
      data[o + 2] = pb;
      data[o + 3] = 255;
    }
    return this.image;
  }

  /** Does the sheet have any ink at all? */
  hasInk(): boolean {
    const { dep, pig, N } = this;
    for (let i = 0; i < N; i++) if (dep[i] > 1e-3 || pig[i] > 1e-3) return true;
    return false;
  }
}

// ---- helpers ----
function hexToRGB(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v =
    m.length === 3
      ? m.split("").map((c) => c + c).join("")
      : m;
  const int = parseInt(v || "f7f5ef", 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
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
