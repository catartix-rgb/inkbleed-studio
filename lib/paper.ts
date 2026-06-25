// Paper substrates and ink material parameters for the simulation.

export interface PaperParams {
  /** how fast water is pulled into the sheet (0..1) */
  absorbency: number;
  /** grain contrast / tooth (0..1) */
  roughness: number;
  /** grain feature scale in cells */
  grain: number;
  /** fibre packing — denser paper resists spread (0..1) */
  density: number;
  /** fibre direction in radians */
  fiberAngle: number;
  /** anisotropy strength of the fibre (0..1) */
  fiberStrength: number;
  /** pre-wetting of the sheet for wet-on-wet (0..1) */
  wetness: number;
  /** resistance to lateral spread (0..1) */
  spreadResistance: number;
  /** base paper colour */
  color: string;
}

export interface InkParams {
  /** thickness — high viscosity spreads slowly (0..1) */
  viscosity: number;
  /** pigment load deposited by the brush (0..1) */
  pigment: number;
  /** how readily ink soaks / spreads into the paper (0..1) */
  absorption: number;
  /** how quickly ink dries and reaches full richness (0..1) */
  drying: number;
  /** residual evaporation tuning (0..1) */
  evaporation: number;
  /** pigment build-up at the drying rim (0..1) */
  edge: number;
  /** ragged-edge / feathering noise (0..1) */
  noise: number;

  // ---- pigment optics (deterministic compositor) ----
  /** pigment density — how fast accumulated ink becomes opaque (0..1) */
  density: number;
  /** ink darkness — pushes dense ink toward deep black (0..1) */
  darkness: number;
  /** wet-to-dry darkening gap (0..1) */
  dryingContrast: number;
  /** black point — deepens shadows / kills faint grey haze (0..1) */
  blackPoint: number;
  /** ink saturation around luminance (0..2) */
  saturation: number;
}

export interface PaperPreset {
  id: string;
  label: string;
  blurb: string;
  paper: PaperParams;
}

export const PAPERS: PaperPreset[] = [
  {
    id: "bristol",
    label: "Smooth Bristol",
    blurb: "Hard, sized surface. Crisp edges, minimal bleed.",
    paper: {
      absorbency: 0.18,
      roughness: 0.12,
      grain: 2.5,
      density: 0.82,
      fiberAngle: 0,
      fiberStrength: 0.05,
      wetness: 0,
      spreadResistance: 0.7,
      color: "#f7f5ef",
    },
  },
  {
    id: "newsprint",
    label: "Newsprint",
    blurb: "Thirsty and soft. Ink feathers quickly.",
    paper: {
      absorbency: 0.7,
      roughness: 0.4,
      grain: 3,
      density: 0.3,
      fiberAngle: 0,
      fiberStrength: 0.2,
      wetness: 0,
      spreadResistance: 0.2,
      color: "#efeade",
    },
  },
  {
    id: "rice",
    label: "Rice Paper",
    blurb: "Sumi-e ground. Long, soft capillary bleed.",
    paper: {
      absorbency: 0.85,
      roughness: 0.25,
      grain: 4,
      density: 0.18,
      fiberAngle: Math.PI / 2,
      fiberStrength: 0.35,
      wetness: 0.08,
      spreadResistance: 0.12,
      color: "#f6f3ea",
    },
  },
  {
    id: "handmade",
    label: "Handmade",
    blurb: "Irregular cotton rag. Pooling and deckled bleed.",
    paper: {
      absorbency: 0.55,
      roughness: 0.85,
      grain: 6,
      density: 0.45,
      fiberAngle: 0.6,
      fiberStrength: 0.45,
      wetness: 0.04,
      spreadResistance: 0.3,
      color: "#f3eee1",
    },
  },
  {
    id: "cardboard",
    label: "Cardboard",
    blurb: "Coarse, fibrous board. Blotchy uneven soak.",
    paper: {
      absorbency: 0.6,
      roughness: 1.0,
      grain: 8,
      density: 0.6,
      fiberAngle: 0,
      fiberStrength: 0.5,
      wetness: 0,
      spreadResistance: 0.4,
      color: "#e9dcc4",
    },
  },
  {
    id: "fabric",
    label: "Fabric",
    blurb: "Woven weave. Strong directional wicking.",
    paper: {
      absorbency: 0.75,
      roughness: 0.7,
      grain: 3.5,
      density: 0.35,
      fiberAngle: Math.PI / 4,
      fiberStrength: 0.8,
      wetness: 0.05,
      spreadResistance: 0.18,
      color: "#f1ece2",
    },
  },
];

export const getPaper = (id: string): PaperPreset =>
  PAPERS.find((p) => p.id === id) ?? PAPERS[0];

export const defaultInk: InkParams = {
  viscosity: 0.35,
  pigment: 0.85,
  absorption: 0.4,
  drying: 0.4,
  evaporation: 0.3,
  edge: 0.55,
  noise: 0.45,
  // tuned for rich India / sumi ink with strong contrast
  density: 0.7,
  darkness: 0.45,
  dryingContrast: 0.5,
  blackPoint: 0.2,
  saturation: 1,
};
