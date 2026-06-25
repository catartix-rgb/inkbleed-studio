// Professional artboard / paper-size system.

export type Unit = "px" | "mm" | "cm" | "in";

export interface Artboard {
  id: string;
  label: string;
  /** width / height in `unit` */
  w: number;
  h: number;
  unit: Unit;
  category: "ISO" | "US" | "Social" | "Large" | "Custom";
}

export interface ArtboardPreset extends Artboard {}

export const PRESETS: ArtboardPreset[] = [
  // ISO A-series (mm)
  { id: "a0", label: "A0", w: 841, h: 1189, unit: "mm", category: "ISO" },
  { id: "a1", label: "A1", w: 594, h: 841, unit: "mm", category: "ISO" },
  { id: "a2", label: "A2", w: 420, h: 594, unit: "mm", category: "ISO" },
  { id: "a3", label: "A3", w: 297, h: 420, unit: "mm", category: "ISO" },
  { id: "a4", label: "A4", w: 210, h: 297, unit: "mm", category: "ISO" },
  { id: "a5", label: "A5", w: 148, h: 210, unit: "mm", category: "ISO" },
  { id: "a6", label: "A6", w: 105, h: 148, unit: "mm", category: "ISO" },
  // US (in)
  { id: "letter", label: "Letter", w: 8.5, h: 11, unit: "in", category: "US" },
  { id: "legal", label: "Legal", w: 8.5, h: 14, unit: "in", category: "US" },
  { id: "tabloid", label: "Tabloid", w: 11, h: 17, unit: "in", category: "US" },
  // Social (px)
  { id: "ig-post", label: "Instagram Post", w: 1080, h: 1080, unit: "px", category: "Social" },
  { id: "ig-story", label: "Story", w: 1080, h: 1920, unit: "px", category: "Social" },
  { id: "reel", label: "Reel Cover", w: 1080, h: 1920, unit: "px", category: "Social" },
  { id: "album", label: "Album Cover", w: 3000, h: 3000, unit: "px", category: "Social" },
  // Large format
  { id: "poster", label: "Poster", w: 18, h: 24, unit: "in", category: "Large" },
  { id: "billboard", label: "Billboard", w: 48, h: 14, unit: "in", category: "Large" },
];

export const DPI_PRESETS = [72, 150, 300, 600, 1200];

const TO_IN: Record<Unit, number> = {
  in: 1,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  px: 1 / 72, // px artboards are treated as 72ppi physical
};

export const toInches = (v: number, unit: Unit) => v * TO_IN[unit];

export interface ArtboardMetrics {
  widthIn: number;
  heightIn: number;
  /** export pixel size at the given dpi */
  pxW: number;
  pxH: number;
  /** PDF/print points (72 per inch) */
  ptW: number;
  ptH: number;
  aspect: number;
  /** human label e.g. "210 × 297 mm · 2480 × 3508 px @ 300dpi" */
  summary: string;
}

export function metrics(a: Artboard, dpi: number): ArtboardMetrics {
  const widthIn = toInches(a.w, a.unit);
  const heightIn = toInches(a.h, a.unit);
  const pxW = Math.max(1, Math.round(widthIn * dpi));
  const pxH = Math.max(1, Math.round(heightIn * dpi));
  const unitLabel =
    a.unit === "px"
      ? `${a.w} × ${a.h} px`
      : `${round(a.w)} × ${round(a.h)} ${a.unit}`;
  return {
    widthIn,
    heightIn,
    pxW,
    pxH,
    ptW: widthIn * 72,
    ptH: heightIn * 72,
    aspect: widthIn / heightIn,
    summary: `${unitLabel} · ${pxW} × ${pxH} px @ ${dpi}dpi`,
  };
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Working-sheet pixel dimensions for the live canvas / ink simulation.
 * The drawing resolution is constant (≈1400px long side) regardless of the
 * artboard's real-world size — only the aspect ratio follows the artboard, so
 * A0 and A6 cost the same to simulate. Real size + DPI are applied at export.
 */
export function workingSheet(aspect: number): { w: number; h: number } {
  const LONG = 1400;
  if (aspect >= 1) return { w: LONG, h: Math.round(LONG / aspect) };
  return { w: Math.round(LONG * aspect), h: LONG };
}

/** Simulation grid (capped cell budget), aspect-matched to the sheet. */
export function simSize(aspect: number): { w: number; h: number } {
  const LONG = 540;
  let w: number, h: number;
  if (aspect >= 1) {
    w = LONG;
    h = Math.max(80, Math.round(LONG / aspect));
  } else {
    h = LONG;
    w = Math.max(80, Math.round(LONG * aspect));
  }
  return { w, h };
}
