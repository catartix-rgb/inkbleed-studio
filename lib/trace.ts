import { type Vec, rdp } from "./geometry";

/**
 * Marching-squares contour tracer.
 *
 * Converts a scalar coverage field (the *actual* rendered ink) into closed
 * polygons that follow the real ink edges — bleed, ragged feathering, dry-brush
 * gaps, marker streaks and calligraphic contrast are all preserved, because we
 * trace the pixels rather than re-deriving geometry from the stroke centreline.
 * Holes (e.g. dry-brush voids) come out as inner loops handled with even-odd fill.
 */
export function marchingSquares(
  field: Float32Array,
  w: number,
  h: number,
  t: number
): Vec[][] {
  const segs: [string, Vec, string, Vec][] = [];
  const at = (x: number, y: number) => field[y * w + x];
  const hk = (x: number, y: number) => `H${x}_${y}`;
  const vk = (x: number, y: number) => `V${x}_${y}`;

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);
      const code =
        (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const T = () => ({ id: hk(x, y), pt: { x: x + frac(a, b, t), y } });
      const R = () => ({ id: vk(x + 1, y), pt: { x: x + 1, y: y + frac(b, c, t) } });
      const B = () => ({ id: hk(x, y + 1), pt: { x: x + frac(d, c, t), y: y + 1 } });
      const L = () => ({ id: vk(x, y), pt: { x, y: y + frac(a, d, t) } });
      const push = (e1: Edge, e2: Edge) => segs.push([e1.id, e1.pt, e2.id, e2.pt]);

      switch (code) {
        case 1: push(L(), B()); break;
        case 2: push(B(), R()); break;
        case 3: push(L(), R()); break;
        case 4: push(T(), R()); break;
        case 5: push(T(), L()); push(B(), R()); break; // saddle
        case 6: push(T(), B()); break;
        case 7: push(T(), L()); break;
        case 8: push(T(), L()); break;
        case 9: push(T(), B()); break;
        case 10: push(T(), R()); push(B(), L()); break; // saddle
        case 11: push(T(), R()); break;
        case 12: push(L(), R()); break;
        case 13: push(B(), R()); break;
        case 14: push(L(), B()); break;
      }
    }
  }

  // link segments into closed loops
  const adj = new Map<string, { pt: Vec; links: string[] }>();
  for (const [ia, pa, ib, pb] of segs) {
    if (!adj.has(ia)) adj.set(ia, { pt: pa, links: [] });
    if (!adj.has(ib)) adj.set(ib, { pt: pb, links: [] });
    adj.get(ia)!.links.push(ib);
    adj.get(ib)!.links.push(ia);
  }
  const used = new Set<string>();
  const eKey = (p: string, q: string) => (p < q ? `${p}|${q}` : `${q}|${p}`);
  const loops: Vec[][] = [];

  for (const [startId, node] of adj) {
    for (const first of node.links) {
      if (used.has(eKey(startId, first))) continue;
      const loop: Vec[] = [node.pt];
      let prev = startId;
      let cur = first;
      used.add(eKey(startId, first));
      let guard = 0;
      while (cur !== startId && guard++ < 200000) {
        const cn = adj.get(cur)!;
        loop.push(cn.pt);
        let nxt: string | null = null;
        for (const n2 of cn.links) {
          if (n2 === prev) continue;
          if (!used.has(eKey(cur, n2))) {
            nxt = n2;
            break;
          }
        }
        if (nxt == null) break;
        used.add(eKey(cur, nxt));
        prev = cur;
        cur = nxt;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

interface Edge {
  id: string;
  pt: Vec;
}
const frac = (a: number, b: number, t: number) => {
  const d = b - a;
  return Math.abs(d) < 1e-6 ? 0.5 : Math.min(1, Math.max(0, (t - a) / d));
};

export interface ToneLevel {
  threshold: number;
  opacity: number;
}

export interface TracedTone {
  opacity: number;
  /** loops in field-cell coordinates */
  loops: Vec[][];
  anchors: number;
}

/**
 * Trace several tonal bands so ink density (soft bleed → solid core) survives.
 * `simplifyEps` is small for faithful output — texture is kept, not flattened.
 */
export function traceTones(
  cov: Float32Array,
  w: number,
  h: number,
  levels: ToneLevel[],
  simplifyEps: number
): { tones: TracedTone[]; anchors: number } {
  // zero a 1-cell border so every contour closes inside the field
  for (let x = 0; x < w; x++) {
    cov[x] = 0;
    cov[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    cov[y * w] = 0;
    cov[y * w + w - 1] = 0;
  }

  const tones: TracedTone[] = [];
  let anchors = 0;
  for (const lvl of levels) {
    const loops = marchingSquares(cov, w, h, lvl.threshold)
      .map((lp) => (simplifyEps > 0 ? rdp(lp, simplifyEps) : lp))
      .filter((lp) => lp.length >= 3);
    let a = 0;
    for (const lp of loops) a += lp.length;
    anchors += a;
    tones.push({ opacity: lvl.opacity, loops, anchors: a });
  }
  return { tones, anchors };
}
