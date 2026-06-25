import type { LogoMode } from "./types";

/**
 * A mode profile controls how the vectorizer interprets a sketch.
 * The philosophy: not perfect geometry, but meaningful, distinctive identity.
 * Higher `simplify` = fewer anchors. Higher `roughness` = more retained
 * imperfection. `widthBoost`/`taper` shape the ink weight. `chaikin` adds
 * organic smoothing passes.
 */
export interface ModeProfile {
  id: LogoMode;
  label: string;
  blurb: string;
  /** RDP epsilon multiplier — how aggressively to drop anchor points */
  simplify: number;
  /** 0..1 retained edge irregularity */
  roughness: number;
  /** multiplier on stroke width */
  widthBoost: number;
  /** 0..1 end-taper amount */
  taper: number;
  /** Chaikin smoothing iterations on the outline */
  chaikin: number;
  /** whether to render a hard contrast / mono treatment */
  mono: boolean;
}

export const MODES: ModeProfile[] = [
  {
    id: "raw",
    label: "Raw Sketch",
    blurb: "Faithful trace. Keeps every gesture and wobble.",
    simplify: 0.35,
    roughness: 1.0,
    widthBoost: 1.0,
    taper: 0.25,
    chaikin: 0,
    mono: false,
  },
  {
    id: "refined",
    label: "Refined Logo",
    blurb: "Cleaned curves, balanced weight, still hand-made.",
    simplify: 1.0,
    roughness: 0.45,
    widthBoost: 1.05,
    taper: 0.4,
    chaikin: 1,
    mono: false,
  },
  {
    id: "minimal",
    label: "Minimal Logo",
    blurb: "Japanese-minimal. Maximum meaning, fewest anchors.",
    simplify: 2.4,
    roughness: 0.15,
    widthBoost: 0.92,
    taper: 0.55,
    chaikin: 2,
    mono: true,
  },
  {
    id: "luxury",
    label: "Luxury Brand",
    blurb: "Tapered, elegant contrast. Couture line quality.",
    simplify: 1.4,
    roughness: 0.25,
    widthBoost: 0.85,
    taper: 0.75,
    chaikin: 2,
    mono: true,
  },
  {
    id: "streetwear",
    label: "Streetwear Brand",
    blurb: "Bold, heavy, grunge edges. Drop-ready mark.",
    simplify: 0.8,
    roughness: 0.8,
    widthBoost: 1.45,
    taper: 0.15,
    chaikin: 0,
    mono: true,
  },
  {
    id: "brutalist",
    label: "Brutalist Brand",
    blurb: "Raw concrete. Angular, uncompromising, no easing.",
    simplify: 1.8,
    roughness: 0.6,
    widthBoost: 1.3,
    taper: 0.0,
    chaikin: 0,
    mono: true,
  },
  {
    id: "experimental",
    label: "Experimental Brand",
    blurb: "Distorted, displaced anchors. Deconstructed type.",
    simplify: 0.6,
    roughness: 1.3,
    widthBoost: 1.1,
    taper: 0.3,
    chaikin: 0,
    mono: false,
  },
];

export const getMode = (id: LogoMode): ModeProfile =>
  MODES.find((m) => m.id === id) ?? MODES[1];
