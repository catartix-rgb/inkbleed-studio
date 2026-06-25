// Core domain types for InkBleed Studio

export type BrushStyle =
  | "inkbleed"
  | "marker"
  | "pencil"
  | "calligraphy"
  | "rough";

export type LogoMode =
  | "raw"
  | "refined"
  | "minimal"
  | "luxury"
  | "streetwear"
  | "brutalist"
  | "experimental";

export type Tool = "brush" | "pan" | "node";

export interface Point {
  x: number;
  y: number;
  /** Pointer pressure 0..1 (0.5 when device reports none) */
  p: number;
  /** timestamp in ms */
  t: number;
}

export interface BrushSettings {
  style: BrushStyle;
  /** base radius in canvas units */
  size: number;
  /** 0..1 — stroke stabilization strength */
  stability: number;
  /** 0..1 — pressure influence on width */
  pressure: number;
  /** 0..1 — organic edge irregularity */
  bleed: number;
  /** 0..1 — opacity */
  opacity: number;
  /** 0..1 — water load fed into the ink simulation */
  wet: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  brush: BrushSettings;
  /** ms timestamp (performance.now) when the stroke began — drives drying */
  createdAt?: number;
}

/** A fitted vector path produced by the vectorizer */
export interface VectorPath {
  id: string;
  /** SVG path "d" string (filled outline) */
  d: string;
  fill: string;
  /** number of anchor points, for the stats readout */
  anchors: number;
  closed: boolean;
}

export interface SymmetryConfig {
  enabled: boolean;
  /** number of radial slices (1 = mirror only) */
  axes: number;
  mirror: boolean;
}

export interface Viewport {
  /** pan offset in screen px */
  x: number;
  y: number;
  /** zoom scale */
  scale: number;
}
