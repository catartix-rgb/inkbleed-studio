import type { VectorResult } from "./vectorize";

/** Parse one of our own "d" strings (only M/C/Z) into structured commands. */
interface Seg {
  type: "M" | "C" | "Z";
  v: number[];
}
function parsePath(d: string): Seg[] {
  const segs: Seg[] = [];
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i++];
    if (t === "M") {
      segs.push({ type: "M", v: [num(tokens[i++]), num(tokens[i++])] });
    } else if (t === "C") {
      segs.push({
        type: "C",
        v: [
          num(tokens[i++]),
          num(tokens[i++]),
          num(tokens[i++]),
          num(tokens[i++]),
          num(tokens[i++]),
          num(tokens[i++]),
        ],
      });
    } else if (t === "Z") {
      segs.push({ type: "Z", v: [] });
    }
  }
  return segs;
}
const num = (s: string) => parseFloat(s);

function pageBox(result: VectorResult, pad: number) {
  const b = result.bbox ?? { x: 0, y: 0, w: 100, h: 100 };
  const w = Math.max(1, b.w + pad * 2);
  const h = Math.max(1, b.h + pad * 2);
  return { b, w, h, ox: pad - b.x, oy: pad - b.y };
}

function hexToRGB(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const int = parseInt(v || "0a0a0a", 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => c / 255) as [
    number,
    number,
    number
  ];
}

/**
 * True vector PDF (PDF 1.4). Y axis is flipped to PDF's bottom-left origin.
 * Bézier curveto maps directly from our cubic "C" commands.
 */
export function toPDF(
  result: VectorResult,
  opts: { color: string; pad?: number } = { color: "#0a0a0a" }
): Blob {
  const pad = opts.pad ?? 40;
  const { w, h, ox, oy } = pageBox(result, pad);
  const flip = (y: number) => h - y;

  let content = "";
  for (const p of result.paths) {
    const [r, g, b] = hexToRGB(p.fill === "currentColor" ? opts.color : p.fill);
    content += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;
    for (const s of parsePath(p.d)) {
      if (s.type === "M") {
        content += `${(s.v[0] + ox).toFixed(2)} ${flip(s.v[1] + oy).toFixed(
          2
        )} m\n`;
      } else if (s.type === "C") {
        content += `${(s.v[0] + ox).toFixed(2)} ${flip(s.v[1] + oy).toFixed(
          2
        )} ${(s.v[2] + ox).toFixed(2)} ${flip(s.v[3] + oy).toFixed(2)} ${(
          s.v[4] + ox
        ).toFixed(2)} ${flip(s.v[5] + oy).toFixed(2)} c\n`;
      } else {
        content += "h\n";
      }
    }
    content += "f\n";
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(2)} ${h.toFixed(
      2
    )}] /Contents 4 0 R /Resources << >> >>`
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

/** EPS (Encapsulated PostScript) vector output — opens in Illustrator. */
export function toEPS(
  result: VectorResult,
  opts: { color: string; pad?: number } = { color: "#0a0a0a" }
): string {
  const pad = opts.pad ?? 40;
  const { w, h, ox, oy } = pageBox(result, pad);
  const flip = (y: number) => h - y;
  let body = "";
  for (const p of result.paths) {
    const [r, g, b] = hexToRGB(p.fill === "currentColor" ? opts.color : p.fill);
    body += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} setrgbcolor\n`;
    body += "newpath\n";
    for (const s of parsePath(p.d)) {
      if (s.type === "M")
        body += `${(s.v[0] + ox).toFixed(2)} ${flip(s.v[1] + oy).toFixed(
          2
        )} moveto\n`;
      else if (s.type === "C")
        body += `${(s.v[0] + ox).toFixed(2)} ${flip(s.v[1] + oy).toFixed(2)} ${(
          s.v[2] + ox
        ).toFixed(2)} ${flip(s.v[3] + oy).toFixed(2)} ${(s.v[4] + ox).toFixed(
          2
        )} ${flip(s.v[5] + oy).toFixed(2)} curveto\n`;
      else body += "closepath\n";
    }
    body += "fill\n";
  }
  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: InkBleed Studio
%%BoundingBox: 0 0 ${Math.ceil(w)} ${Math.ceil(h)}
%%EndComments
${body}showpage
%%EOF`;
}

/**
 * Rasterize an SVG string to a PNG Blob at a target pixel width.
 * Rendered from the vector source, so output is crisp at any resolution.
 */
export function svgToPNG(
  svg: string,
  targetWidth: number,
  background: string | null
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const widthMatch = svg.match(/width="([\d.]+)"/);
    const heightMatch = svg.match(/height="([\d.]+)"/);
    const sw = widthMatch ? parseFloat(widthMatch[1]) : 1000;
    const sh = heightMatch ? parseFloat(heightMatch[1]) : 1000;
    const scale = targetWidth / sw;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("no ctx"));
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load failed"));
    };
    img.src = url;
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
