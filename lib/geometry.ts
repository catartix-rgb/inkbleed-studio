import type { Point } from "./types";

export interface Vec {
  x: number;
  y: number;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpPt = (a: Point, b: Point, t: number): Point => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  p: lerp(a.p, b.p, t),
  t: lerp(a.t, b.t, t),
});

/** Deterministic pseudo-random in [-1,1] from a seed — stable across renders */
export function seededNoise(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * One-euro-ish exponential smoothing for stroke stabilization.
 * strength 0 = raw, 1 = heavy lag/smoothing.
 */
export function stabilize(points: Point[], strength: number): Point[] {
  if (points.length < 3 || strength <= 0) return points;
  const alpha = lerp(1, 0.12, Math.min(1, strength));
  const out: Point[] = [points[0]];
  let prev = points[0];
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const sm: Point = {
      x: lerp(prev.x, cur.x, alpha),
      y: lerp(prev.y, cur.y, alpha),
      p: lerp(prev.p, cur.p, alpha),
      t: cur.t,
    };
    out.push(sm);
    prev = sm;
  }
  return out;
}

/** Chaikin-style corner cutting for extra organic smoothness */
export function chaikin(points: Vec[], iterations = 1): Vec[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 3) break;
    const next: Vec[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      next.push({ x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) });
      next.push({ x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/** Ramer–Douglas–Peucker simplification — drives "minimal anchor points" */
export function rdp<T extends Vec>(points: T[], epsilon: number): T[] {
  if (points.length < 3) return points.slice();
  const first = 0;
  const last = points.length - 1;
  let index = -1;
  let maxDist = 0;
  for (let i = first + 1; i < last; i++) {
    const d = perpDist(points[i], points[first], points[last]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon && index !== -1) {
    const left = rdp(points.slice(first, index + 1), epsilon);
    const right = rdp(points.slice(index, last + 1), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[first], points[last]];
}

function perpDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Resample a polyline to roughly even spacing — stabilizes width + offset math */
export function resample(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  let prev = points[0];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    let a = prev;
    const b = points[i];
    let segLen = dist(a, b);
    while (acc + segLen >= spacing) {
      const remain = spacing - acc;
      const t = remain / (segLen || 1e-6);
      const np = lerpPt(a, b, t);
      out.push(np);
      a = np;
      segLen = dist(a, b);
      acc = 0;
      prev = np;
    }
    acc += segLen;
    prev = b;
  }
  const lastOut = out[out.length - 1];
  const lastIn = points[points.length - 1];
  if (dist(lastOut, lastIn) > spacing * 0.4) out.push(lastIn);
  return out;
}

/** Unit normal of the segment a->b (pointing left) */
export function normal(a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  return { x: -dy / len, y: dx / len };
}
