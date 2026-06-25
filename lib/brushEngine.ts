import type { Stroke, Point } from "./types";
import { stabilize, resample, normal, seededNoise } from "./geometry";

/**
 * The InkBleed engine. Renders a stroke onto a 2D context simulating:
 *  - ink spreading on paper (multi-pass soft offsets)
 *  - slight edge irregularities (seeded normal displacement)
 *  - organic texture (per-brush grain)
 *  - natural pressure variation (width + alpha)
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  opts: { preview?: boolean } = {}
) {
  const smoothed = stabilize(stroke.points, stroke.brush.stability);
  const pts = resample(smoothed, Math.max(1.5, stroke.brush.size * 0.25));
  if (pts.length === 0) return;
  const b = stroke.brush;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (pts.length === 1) {
    drawDot(ctx, pts[0], stroke);
    ctx.restore();
    return;
  }

  switch (b.style) {
    case "inkbleed":
      drawInkBleed(ctx, pts, stroke);
      break;
    case "marker":
      drawMarker(ctx, pts, stroke);
      break;
    case "pencil":
      drawPencil(ctx, pts, stroke);
      break;
    case "calligraphy":
      drawCalligraphy(ctx, pts, stroke);
      break;
    case "rough":
      drawRough(ctx, pts, stroke);
      break;
  }
  ctx.restore();
}

function widthAt(stroke: Stroke, p: Point, taper = 1): number {
  const b = stroke.brush;
  const press = 1 - b.pressure + b.pressure * (0.35 + p.p);
  return Math.max(0.4, b.size * press * taper);
}

function ribbon(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  stroke: Stroke,
  widthScale: number,
  jitter: number,
  jSeed: number
) {
  const n = pts.length;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const nm = normal(prev, next);
    const tEnd = Math.min(i, n - 1 - i) / Math.max(1, (n - 1) / 2);
    const taper = 0.55 + 0.45 * Math.min(1, tEnd);
    let w = widthAt(stroke, pts[i], taper) * 0.5 * widthScale;
    if (stroke.brush.style === "calligraphy") {
      const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
      w *= 0.3 + 1.3 * Math.abs(Math.cos(ang - Math.PI / 4));
    }
    const jl = seededNoise(i * 1.7 + jSeed) * jitter;
    const jr = seededNoise(i * 3.1 + jSeed * 2) * jitter;
    left.push({ x: pts[i].x + nm.x * (w + jl), y: pts[i].y + nm.y * (w + jl) });
    right.push({ x: pts[i].x - nm.x * (w + jr), y: pts[i].y - nm.y * (w + jr) });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

function drawInkBleed(ctx: CanvasRenderingContext2D, pts: Point[], stroke: Stroke) {
  const b = stroke.brush;
  // soft bleed halo passes
  const passes = 3;
  for (let k = passes; k >= 1; k--) {
    ribbon(ctx, pts, stroke, 1 + (k / passes) * b.bleed * 0.9, b.bleed * (k * 1.2), k * 13);
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = b.opacity * (0.12 + 0.05 * k) * (b.bleed * 0.7 + 0.3);
    ctx.fill();
  }
  // crisp core
  ribbon(ctx, pts, stroke, 1, b.bleed * 0.5, 99);
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = b.opacity;
  ctx.fill();
}

function drawMarker(ctx: CanvasRenderingContext2D, pts: Point[], stroke: Stroke) {
  ribbon(ctx, pts, stroke, 1, 0.2, 7);
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.brush.opacity * 0.85;
  ctx.fill();
  // semi-dry double edge
  ribbon(ctx, pts, stroke, 0.7, 0.1, 21);
  ctx.globalAlpha = stroke.brush.opacity * 0.5;
  ctx.fill();
}

function drawPencil(ctx: CanvasRenderingContext2D, pts: Point[], stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  const b = stroke.brush;
  // many faint grainy lines = graphite texture
  for (let s = 0; s < 5; s++) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const w = widthAt(stroke, pts[i]) * 0.5;
      const jx = seededNoise(i * 2.1 + s * 9) * w * 0.9;
      const jy = seededNoise(i * 3.3 + s * 4) * w * 0.9;
      const x = pts[i].x + jx;
      const y = pts[i].y + jy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = b.opacity * 0.18;
    ctx.stroke();
  }
}

function drawCalligraphy(ctx: CanvasRenderingContext2D, pts: Point[], stroke: Stroke) {
  ribbon(ctx, pts, stroke, 1, 0.15, 5);
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.brush.opacity;
  ctx.fill();
}

function drawRough(ctx: CanvasRenderingContext2D, pts: Point[], stroke: Stroke) {
  const b = stroke.brush;
  // broken, scratchy multi-ribbon
  for (let s = 0; s < 3; s++) {
    ribbon(ctx, pts, stroke, 0.9 + s * 0.15, 1.6 + b.bleed * 2, s * 17 + 3);
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = b.opacity * (0.5 - s * 0.12);
    ctx.fill();
  }
}

function drawDot(ctx: CanvasRenderingContext2D, p: Point, stroke: Stroke) {
  const r = widthAt(stroke, p) * 0.5;
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.brush.opacity;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}
