import type { BrushSettings, BrushStyle } from "./types";

/** Paper sheet size in world units. */
export const SHEET_W = 1240;
export const SHEET_H = 1750; // ISO-ish portrait sheet

/** Simulation grid resolution (decoupled from display for performance). */
export const SIM_W = 372;
export const SIM_H = 525;

export const worldToSim = (x: number, y: number) => ({
  sx: (x / SHEET_W) * SIM_W,
  sy: (y / SHEET_H) * SIM_H,
});

/** Average world->sim scale, for converting a brush radius. */
export const SIM_SCALE = (SIM_W / SHEET_W + SIM_H / SHEET_H) / 2;

export interface DepositOpts {
  water: number;
  pigment: number;
  noise: number;
}

/** Map a brush style + settings onto ink-deposit behaviour. */
export function brushDeposit(brush: BrushSettings): DepositOpts {
  const wet = brush.wet;
  const bleed = brush.bleed;
  const byStyle: Record<BrushStyle, DepositOpts> = {
    inkbleed: {
      water: 0.5 + wet * 1.0 + bleed * 0.4,
      pigment: 0.9,
      noise: 0.2 + bleed * 0.3,
    },
    marker: {
      water: 0.25 + wet * 0.4,
      pigment: 1.25,
      noise: 0.1,
    },
    pencil: {
      water: 0.04 + wet * 0.1,
      pigment: 0.7,
      noise: 0.85,
    },
    calligraphy: {
      water: 0.4 + wet * 0.8,
      pigment: 1.05,
      noise: 0.15,
    },
    rough: {
      water: 0.3 + wet * 0.7,
      pigment: 0.9,
      noise: 0.9,
    },
  };
  return byStyle[brush.style];
}
