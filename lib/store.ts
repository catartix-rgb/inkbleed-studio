import { create } from "zustand";
import type {
  Stroke,
  BrushSettings,
  BrushStyle,
  LogoMode,
  Tool,
  Viewport,
  SymmetryConfig,
} from "./types";
import {
  type PaperParams,
  type InkParams,
  getPaper,
  defaultInk,
  PAPERS,
} from "./paper";
import { type Artboard, type Unit, PRESETS, metrics } from "./artboard";
import { setSheet } from "./sheet";

export type ExportMode = "clean" | "faithful";

export interface GridConfig {
  visible: boolean;
  size: number;
  snap: boolean;
}

interface StudioState {
  strokes: Stroke[];
  redoStack: Stroke[];
  brush: BrushSettings;
  color: string;
  tool: Tool;
  mode: LogoMode;
  viewport: Viewport;
  theme: "dark" | "light";
  grid: GridConfig;
  symmetry: SymmetryConfig;
  showVector: boolean;
  /** user multiplier on simplification — fewer/more anchor points */
  vectorDetail: number;
  /** keep raster sketch visible beneath the vector overlay */
  showSketchUnderVector: boolean;

  // ---- ink & paper simulation ----
  /** physical ink simulation on/off (vs. flat brush) */
  simEnabled: boolean;
  paperId: string;
  paper: PaperParams;
  ink: InkParams;
  /** bumped when the paper substrate must be rebuilt */
  paperRevision: number;

  // ---- artboard & export ----
  artboard: Artboard;
  dpi: number;
  exportMode: ExportMode;
  /** bumped when the working sheet is reshaped (artboard aspect change) */
  sheetRevision: number;

  /** bumped whenever geometry changes — consumers re-run vectorize */
  revision: number;
  /** bumped only on undo/redo/clear — tells the sim to rebuild from strokes */
  rebuildSignal: number;

  addStroke: (s: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  removeStroke: (id: string) => void;

  setBrush: (patch: Partial<BrushSettings>) => void;
  setBrushStyle: (style: BrushStyle) => void;
  setColor: (c: string) => void;
  setTool: (t: Tool) => void;
  setMode: (m: LogoMode) => void;
  setViewport: (patch: Partial<Viewport>) => void;
  resetView: () => void;
  toggleTheme: () => void;
  setGrid: (patch: Partial<GridConfig>) => void;
  setSymmetry: (patch: Partial<SymmetryConfig>) => void;
  toggleVector: () => void;
  setVectorDetail: (v: number) => void;
  toggleSketchUnderVector: () => void;

  toggleSim: () => void;
  setPaperPreset: (id: string) => void;
  setPaperParam: (patch: Partial<PaperParams>) => void;
  setInkParam: (patch: Partial<InkParams>) => void;

  setArtboard: (a: Artboard) => void;
  setCustomArtboard: (w: number, h: number, unit: Unit) => void;
  setDpi: (dpi: number) => void;
  setExportMode: (m: ExportMode) => void;
}

const A4 = PRESETS.find((p) => p.id === "a4")!;

const defaultBrush: BrushSettings = {
  style: "inkbleed",
  size: 22,
  stability: 0.55,
  pressure: 0.7,
  bleed: 0.5,
  opacity: 1,
  wet: 0.6,
  angle: -Math.PI / 4, // classic 45° broad-nib
};

export const useStudio = create<StudioState>((set) => ({
  strokes: [],
  redoStack: [],
  brush: defaultBrush,
  color: "#0a0a0a",
  tool: "brush",
  mode: "refined",
  viewport: { x: 0, y: 0, scale: 1 },
  theme: "light",
  grid: { visible: false, size: 32, snap: false },
  symmetry: { enabled: false, axes: 1, mirror: true },
  showVector: false,
  vectorDetail: 1,
  showSketchUnderVector: false,
  revision: 0,
  rebuildSignal: 0,

  simEnabled: true,
  paperId: PAPERS[2].id, // rice paper — expressive sumi-e default
  paper: { ...getPaper(PAPERS[2].id).paper },
  ink: { ...defaultInk },
  paperRevision: 0,

  artboard: { ...A4 },
  dpi: 300,
  exportMode: "faithful",
  sheetRevision: 0,

  addStroke: (s) =>
    set((st) => ({
      strokes: [...st.strokes, s],
      redoStack: [],
      revision: st.revision + 1,
    })),
  undo: () =>
    set((st) => {
      if (st.strokes.length === 0) return st;
      const last = st.strokes[st.strokes.length - 1];
      return {
        strokes: st.strokes.slice(0, -1),
        redoStack: [...st.redoStack, last],
        revision: st.revision + 1,
        rebuildSignal: st.rebuildSignal + 1,
      };
    }),
  redo: () =>
    set((st) => {
      if (st.redoStack.length === 0) return st;
      const last = st.redoStack[st.redoStack.length - 1];
      return {
        strokes: [...st.strokes, last],
        redoStack: st.redoStack.slice(0, -1),
        revision: st.revision + 1,
        rebuildSignal: st.rebuildSignal + 1,
      };
    }),
  clear: () =>
    set((st) => ({
      strokes: [],
      redoStack: [],
      revision: st.revision + 1,
      rebuildSignal: st.rebuildSignal + 1,
    })),
  removeStroke: (id) =>
    set((st) => ({
      strokes: st.strokes.filter((s) => s.id !== id),
      revision: st.revision + 1,
      rebuildSignal: st.rebuildSignal + 1,
    })),

  setBrush: (patch) => set((st) => ({ brush: { ...st.brush, ...patch } })),
  setBrushStyle: (style) => set((st) => ({ brush: { ...st.brush, style } })),
  setColor: (color) => set({ color }),
  setTool: (tool) => set({ tool }),
  setMode: (mode) => set((st) => ({ mode, revision: st.revision + 1 })),
  setViewport: (patch) =>
    set((st) => ({ viewport: { ...st.viewport, ...patch } })),
  resetView: () => set({ viewport: { x: 0, y: 0, scale: 1 } }),
  toggleTheme: () =>
    set((st) => ({ theme: st.theme === "dark" ? "light" : "dark" })),
  setGrid: (patch) => set((st) => ({ grid: { ...st.grid, ...patch } })),
  setSymmetry: (patch) =>
    set((st) => ({
      symmetry: { ...st.symmetry, ...patch },
      revision: st.revision + 1,
    })),
  toggleVector: () => set((st) => ({ showVector: !st.showVector })),
  setVectorDetail: (v) =>
    set((st) => ({ vectorDetail: v, revision: st.revision + 1 })),
  toggleSketchUnderVector: () =>
    set((st) => ({ showSketchUnderVector: !st.showSketchUnderVector })),

  toggleSim: () => set((st) => ({ simEnabled: !st.simEnabled })),
  setPaperPreset: (id) =>
    set((st) => ({
      paperId: id,
      paper: { ...getPaper(id).paper },
      paperRevision: st.paperRevision + 1,
    })),
  setPaperParam: (patch) =>
    set((st) => ({
      paper: { ...st.paper, ...patch },
      paperRevision: st.paperRevision + 1,
    })),
  setInkParam: (patch) => set((st) => ({ ink: { ...st.ink, ...patch } })),

  setArtboard: (a) =>
    set((st) => {
      const m = metrics(a, st.dpi);
      const changed = setSheet(m.aspect);
      return {
        artboard: a,
        sheetRevision: changed ? st.sheetRevision + 1 : st.sheetRevision,
        revision: st.revision + 1,
      };
    }),
  setCustomArtboard: (w, h, unit) =>
    set((st) => {
      const a: Artboard = {
        id: "custom",
        label: "Custom",
        w,
        h,
        unit,
        category: "Custom",
      };
      const m = metrics(a, st.dpi);
      const changed = setSheet(m.aspect);
      return {
        artboard: a,
        sheetRevision: changed ? st.sheetRevision + 1 : st.sheetRevision,
        revision: st.revision + 1,
      };
    }),
  setDpi: (dpi) => set({ dpi }),
  setExportMode: (m) => set({ exportMode: m }),
}));
