import { workingSheet, simSize } from "./artboard";

/**
 * Current working-sheet + simulation dimensions in world units / sim cells.
 * Mutable: `setSheet(aspect)` reshapes it when the artboard changes. The drawing
 * resolution stays constant; only the aspect ratio follows the artboard.
 */
export const SHEET = {
  w: 1240,
  h: 1750,
  simW: 372,
  simH: 525,
  scale: 372 / 1240,
};

/** Reshape the sheet + sim grid to a new aspect ratio. Returns whether it changed. */
export function setSheet(aspect: number): boolean {
  const ws = workingSheet(aspect);
  const ss = simSize(aspect);
  if (ws.w === SHEET.w && ws.h === SHEET.h && ss.w === SHEET.simW && ss.h === SHEET.simH)
    return false;
  SHEET.w = ws.w;
  SHEET.h = ws.h;
  SHEET.simW = ss.w;
  SHEET.simH = ss.h;
  SHEET.scale = (ss.w / ws.w + ss.h / ws.h) / 2;
  return true;
}

export const worldToSim = (x: number, y: number) => ({
  sx: (x / SHEET.w) * SHEET.simW,
  sy: (y / SHEET.h) * SHEET.simH,
});
