import type { Stroke } from "./types";
import type { PaperParams, InkParams } from "./paper";
import { type Artboard, metrics } from "./artboard";
import { SHEET } from "./sheet";
import { renderDryField } from "./inkSim";
import { traceTones } from "./trace";
import { vectorize } from "./vectorize";
import { getMode } from "./modes";
import { svgToPNG } from "./export";

/** A path laid out in final artboard *point* coordinates (72pt = 1in). */
export interface ExPath {
  d: string;
  fill: string;
  opacity: number;
  stroke?: boolean;
}

export interface Layout {
  paths: ExPath[];
  ptW: number;
  ptH: number;
  anchors: number;
  /** dominant ink colour as #hex */
  color: string;
}

export type ExportMode = "canvas" | "faithful" | "clean";

interface BuildArgs {
  strokes: Stroke[];
  paper: PaperParams;
  ink: InkParams;
  artboard: Artboard;
  dpi: number;
  mode: string; // LogoMode id (clean only)
  exportMode: ExportMode;
  inkColor: string; // fallback / mono colour
}

const MARGIN = 0.08;

/** Build a laid-out vector representation of the artwork for the artboard. */
export function buildLayout(args: BuildArgs): Layout {
  const m = metrics(args.artboard, args.dpi);
  const ptW = m.ptW;
  const ptH = m.ptH;

  if (args.exportMode === "faithful") {
    return faithfulLayout(args, ptW, ptH);
  }
  return cleanLayout(args, ptW, ptH);
}

// ---- Faithful: trace the actual ink raster ----
function faithfulLayout(args: BuildArgs, ptW: number, ptH: number): Layout {
  const sim = renderDryField(SHEET.simW, SHEET.simH, args.paper, args.ink, args.strokes);
  const { cov, color } = sim.coverage();
  const levels = [
    { threshold: 0.16, opacity: 0.4 },
    { threshold: 0.5, opacity: 1 },
  ];
  const { tones, anchors } = traceTones(cov, SHEET.simW, SHEET.simH, levels, 0.5);

  // bbox across all loops (sim-cell coords)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const t of tones)
    for (const lp of t.loops)
      for (const p of lp) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
  const fit = fitTransform(minX, minY, maxX - minX, maxY - minY, ptW, ptH);
  const hex = rgbToHex(color);

  const paths: ExPath[] = [];
  for (const t of tones) {
    if (t.loops.length === 0) continue;
    let d = "";
    for (const lp of t.loops) {
      d += `M ${pt(lp[0].x, fit.sx, fit.tx)} ${pt(lp[0].y, fit.sy, fit.ty)} `;
      for (let i = 1; i < lp.length; i++)
        d += `L ${pt(lp[i].x, fit.sx, fit.tx)} ${pt(lp[i].y, fit.sy, fit.ty)} `;
      d += "Z ";
    }
    paths.push({ d: d.trim(), fill: hex, opacity: t.opacity });
  }
  return { paths, ptW, ptH, anchors, color: hex };
}

// ---- Clean: optimized Bézier outlines ----
function cleanLayout(args: BuildArgs, ptW: number, ptH: number): Layout {
  const vr = vectorize(args.strokes, getMode(args.mode as never));
  const b = vr.bbox ?? { x: 0, y: 0, w: 1, h: 1 };
  const fit = fitTransform(b.x, b.y, b.w, b.h, ptW, ptH);
  const paths: ExPath[] = vr.paths.map((p) => ({
    d: transformD(p.d, fit.sx, fit.sy, fit.tx, fit.ty),
    fill: p.fill === "currentColor" ? args.inkColor : p.fill,
    opacity: 1,
  }));
  return { paths, ptW, ptH, anchors: vr.anchors, color: args.inkColor };
}

interface Fit {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}
function fitTransform(
  bx: number,
  by: number,
  bw: number,
  bh: number,
  ptW: number,
  ptH: number
): Fit {
  if (bw <= 0 || bh <= 0 || !isFinite(bw)) return { sx: 1, sy: 1, tx: 0, ty: 0 };
  const availW = ptW * (1 - 2 * MARGIN);
  const availH = ptH * (1 - 2 * MARGIN);
  const s = Math.min(availW / bw, availH / bh);
  return {
    sx: s,
    sy: s,
    tx: (ptW - bw * s) / 2 - bx * s,
    ty: (ptH - bh * s) / 2 - by * s,
  };
}
const pt = (v: number, s: number, t: number) => round(v * s + t);
const round = (v: number) => Math.round(v * 100) / 100;

// ---- variant transforms ----
export interface RenderOpts {
  transparent?: boolean;
  mono?: boolean; // force single solid colour
  invert?: boolean; // light ink on dark
  outline?: boolean; // stroke instead of fill
}

export function layoutToSVG(layout: Layout, opts: RenderOpts = {}): string {
  const { ptW, ptH } = layout;
  const inkColor = opts.invert ? "#ffffff" : opts.mono ? "#000000" : null;
  const bg = opts.invert
    ? "#0a0a0a"
    : opts.transparent
    ? null
    : "#ffffff";
  const bgRect = bg
    ? `<rect width="${round(ptW)}" height="${round(ptH)}" fill="${bg}"/>`
    : "";
  const body = layout.paths
    .map((p, i) => {
      const fill = inkColor ?? p.fill;
      if (opts.outline)
        return `<path d="${p.d}" fill="none" stroke="${fill}" stroke-width="1.2" stroke-opacity="${p.opacity}"/>`;
      return `<path d="${p.d}" fill="${fill}" fill-opacity="${p.opacity}" fill-rule="evenodd" data-layer="${i}"/>`;
    })
    .join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(
    ptW
  )}pt" height="${round(ptH)}pt" viewBox="0 0 ${round(ptW)} ${round(
    ptH
  )}">
  ${bgRect}
  <g id="ink-artwork">
    ${body}
  </g>
</svg>`;
}

// ---- vector PDF / EPS (handle M/L/C/Z, opacity baked over white) ----
interface Seg {
  t: "M" | "L" | "C" | "Z";
  v: number[];
}
function parse(d: string): Seg[] {
  const segs: Seg[] = [];
  const tk = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let i = 0;
  const n = (): number => parseFloat(tk[i++]);
  while (i < tk.length) {
    const c = tk[i++].toUpperCase();
    if (c === "M") segs.push({ t: "M", v: [n(), n()] });
    else if (c === "L") segs.push({ t: "L", v: [n(), n()] });
    else if (c === "C") segs.push({ t: "C", v: [n(), n(), n(), n(), n(), n()] });
    else if (c === "Z") segs.push({ t: "Z", v: [] });
  }
  return segs;
}

/** Apply an affine (scale+translate) to every coordinate pair in a path d. */
export function transformD(d: string, sx: number, sy: number, tx: number, ty: number): string {
  const map = (x: number, y: number) => `${round(x * sx + tx)} ${round(y * sy + ty)}`;
  return parse(d)
    .map((s) => {
      if (s.t === "Z") return "Z";
      if (s.t === "M") return `M ${map(s.v[0], s.v[1])}`;
      if (s.t === "L") return `L ${map(s.v[0], s.v[1])}`;
      return `C ${map(s.v[0], s.v[1])} ${map(s.v[2], s.v[3])} ${map(s.v[4], s.v[5])}`;
    })
    .join(" ");
}

function blendOverWhite(hex: string, op: number): [number, number, number] {
  const [r, g, b] = hexToRGB(hex);
  return [r * op + 255 * (1 - op), g * op + 255 * (1 - op), b * op + 255 * (1 - op)];
}

export function layoutToPDF(layout: Layout, opts: RenderOpts = {}): Blob {
  const { ptW, ptH } = layout;
  const flip = (y: number) => ptH - y;
  const inkOverride = opts.invert ? "#ffffff" : opts.mono ? "#000000" : null;
  let content = "";
  if (opts.invert) content += `0.04 0.04 0.04 rg\n0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)} re f\n`;
  for (const p of layout.paths) {
    const base = inkOverride ?? p.fill;
    const [r, g, b] = opts.invert
      ? hexToRGB(base).map((c) => c / 255)
      : blendOverWhite(base, p.opacity).map((c) => c / 255);
    content += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;
    for (const s of parse(p.d)) {
      if (s.t === "M") content += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} m\n`;
      else if (s.t === "L") content += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} l\n`;
      else if (s.t === "C")
        content += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} ${s.v[2].toFixed(
          2
        )} ${flip(s.v[3]).toFixed(2)} ${s.v[4].toFixed(2)} ${flip(s.v[5]).toFixed(2)} c\n`;
      else content += "h\n";
    }
    content += "f*\n";
  }
  const objs: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(
      2
    )}] /Contents 4 0 R /Resources << >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const off: number[] = [];
  objs.forEach((o, idx) => {
    off.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of off) pdf += `${o.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function layoutToEPS(layout: Layout, opts: RenderOpts = {}): string {
  const { ptW, ptH } = layout;
  const flip = (y: number) => ptH - y;
  const inkOverride = opts.mono ? "#000000" : null;
  let body = "";
  for (const p of layout.paths) {
    const [r, g, b] = blendOverWhite(inkOverride ?? p.fill, p.opacity).map((c) => c / 255);
    body += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} setrgbcolor\nnewpath\n`;
    for (const s of parse(p.d)) {
      if (s.t === "M") body += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} moveto\n`;
      else if (s.t === "L") body += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} lineto\n`;
      else if (s.t === "C")
        body += `${s.v[0].toFixed(2)} ${flip(s.v[1]).toFixed(2)} ${s.v[2].toFixed(
          2
        )} ${flip(s.v[3]).toFixed(2)} ${s.v[4].toFixed(2)} ${flip(s.v[5]).toFixed(
          2
        )} curveto\n`;
      else body += "closepath\n";
    }
    body += "fill\n";
  }
  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: InkBleed Studio
%%BoundingBox: 0 0 ${Math.ceil(ptW)} ${Math.ceil(ptH)}
%%EndComments
${body}showpage
%%EOF`;
}

export async function layoutToPNG(
  layout: Layout,
  pxW: number,
  transparent: boolean,
  invert = false
): Promise<Blob> {
  const svg = layoutToSVG(layout, { transparent, invert });
  const bg = invert ? "#0a0a0a" : transparent ? null : "#ffffff";
  return svgToPNG(svg, pxW, bg);
}

/**
 * Canvas Export (WYSIWYE) — a raster capture that is visually identical to the
 * on-screen preview: paper texture, ink bleed, drying, pigment accumulation,
 * edge feathering, brush texture and grain are all kept. No vectorization.
 * The composited ink+paper image is upscaled exactly as the canvas displays it.
 */
export async function canvasRaster(
  strokes: Stroke[],
  paper: PaperParams,
  ink: InkParams,
  pxW: number,
  pxH: number,
  opts: { mime?: string; withPaper?: boolean } = {}
): Promise<Blob> {
  const sim = renderDryField(SHEET.simW, SHEET.simH, paper, ink, strokes);
  const img = sim.getImage();
  const src = document.createElement("canvas");
  src.width = SHEET.simW;
  src.height = SHEET.simH;
  src.getContext("2d")!.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(pxW));
  out.height = Math.max(1, Math.round(pxH));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  if (opts.mime === "image/jpeg") {
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.drawImage(src, 0, 0, SHEET.simW, SHEET.simH, 0, 0, out.width, out.height);
  const mime = opts.mime ?? "image/png";
  return new Promise((res, rej) =>
    out.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), mime, 0.95)
  );
}

/**
 * Logo Master Export — one operation produces a full brand package:
 * master SVG (faithful + clean), print PDF, transparent PNG, monochrome,
 * inverted, outlined, plus a source vector bundle. Returned as a single .zip.
 */
export async function logoMasterZip(
  faithful: Layout,
  clean: Layout,
  name: string,
  pngPxW: number,
  canvasPng?: Blob
): Promise<Blob> {
  const { makeZip, strBytes, blobBytes } = await import("./zip");
  const svg = (s: string) => strBytes(s);
  const entries = [
    ...(canvasPng
      ? [{ name: `${name}/canvas-wysiwye.png`, data: await blobBytes(canvasPng) }]
      : []),
    { name: `${name}/master-faithful.svg`, data: svg(layoutToSVG(faithful, { transparent: true })) },
    { name: `${name}/master-clean.svg`, data: svg(layoutToSVG(clean, { transparent: true })) },
    { name: `${name}/print.pdf`, data: await blobBytes(layoutToPDF(faithful)) },
    { name: `${name}/transparent.png`, data: await blobBytes(await layoutToPNG(faithful, pngPxW, true)) },
    { name: `${name}/monochrome.svg`, data: svg(layoutToSVG(clean, { mono: true, transparent: true })) },
    { name: `${name}/inverted.svg`, data: svg(layoutToSVG(faithful, { invert: true })) },
    { name: `${name}/outlined.svg`, data: svg(layoutToSVG(clean, { outline: true, transparent: true })) },
    { name: `${name}/source-clean.eps`, data: svg(layoutToEPS(clean)) },
    {
      name: `${name}/README.txt`,
      data: strBytes(
        `${name} — Logo Master Export from InkBleed Studio\n\n` +
          `master-faithful.svg  Faithful ink vector (matches the canvas)\n` +
          `master-clean.svg     Optimized clean vector (minimal anchors)\n` +
          `print.pdf            Print-ready vector PDF\n` +
          `transparent.png      Transparent raster\n` +
          `monochrome.svg       Single-colour version\n` +
          `inverted.svg         Light-on-dark version\n` +
          `outlined.svg         Stroke outline version\n` +
          `source-clean.eps     EPS source for Illustrator\n`
      ),
    },
  ];
  return makeZip(entries);
}

function hexToRGB(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(v || "0a0a0a", 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function rgbToHex(rgb: [number, number, number]): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}
