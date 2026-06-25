<div align="center">

# InkBleed Studio

**Sketch logo concepts with real ink physics, then convert them into clean, production-ready vectors.**

A dedicated logo-design tool where a pressure-sensitive brush feeds a grid-based
ink-on-paper fluid simulation — ink bleeds through paper fibres, pools, dries and
darkens at the edges — and the gesture is preserved as editable SVG.

</div>

---

## Why it's different

This is **not** a normal digital canvas. Ink does not "scale a brush texture" — it
is simulated as a fluid moving through a paper substrate:

- Ink **bleeds** through fibres via capillary action
- Pigment **accumulates** and darkens at the drying rim (edge darkening / backruns)
- Water **soaks** unevenly into the paper and **dries** over time
- Strokes keep **evolving after you lift the pen** until the sheet is dry
- **Wet-on-wet** vs **wet-on-dry** behaviour falls out of the physics

The vectorizer favours **expressive, imperfect, human-made forms** — brutalism,
grunge, experimental typography, Japanese minimalism and contemporary fashion
branding. The goal is meaningful, distinctive identity, not perfect geometry.

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS** — Swiss / Figma / Procreate-inspired UI
- **Canvas 2D** + typed-array fluid sim for ink · **SVG** for vector output & export
- **Zustand** for state

## Getting started

```bash
# 1. install
npm install

# 2. develop
npm run dev          # http://localhost:3000

# 3. production build
npm run build
npm run start

# 4. lint
npm run lint
```

Requirements: **Node 18.18+** (Node 20/22/24 recommended).

## Deployment (Vercel)

The project is a zero-config Next.js app and deploys to Vercel as-is.

```bash
npm i -g vercel
vercel            # link + preview deploy
vercel --prod     # production deploy
```

Or import the GitHub repo at [vercel.com/new](https://vercel.com/new) — Vercel
auto-detects Next.js. No environment variables are required.

## Architecture

```
app/
  layout.tsx          root layout + metadata
  page.tsx            studio shell (top bar, rails, canvas, panels)
  globals.css         theme tokens (light/dark), Swiss UI primitives

components/
  Canvas.tsx          pointer input · viewport · drives the ink sim & rendering
  InkLab.tsx          "InkBleed Laboratory" — paper + ink + drying controls
  BrushPanel.tsx      brush engine, size/pressure/bleed, colour, guides
  LeftPanel.tsx       tabbed Brush / InkBleed Lab
  VectorPanel.tsx     interpretation modes · live preview · stats · export
  VectorOverlay.tsx   live vector overlay aligned to the canvas
  Toolbar / TopBar / StatusBar / Icons

lib/
  inkSim.ts           the fluid engine (water / pigment / paper fields)
  paper.ts            paper substrates + ink material parameters
  sheet.ts            sheet geometry + brush→ink deposit mapping
  brushEngine.ts      InkBleed raster brushes (flat-ink fallback mode)
  vectorize.ts        RDP simplify → Catmull-Rom → cubic Bézier → SVG paths
  modes.ts            7 logo interpretation profiles
  export.ts           SVG / PDF / EPS / PNG / 4K-PNG generation
  geometry.ts         smoothing, resampling, RDP, normals
  store.ts            Zustand store
  useVector.ts        memoized vectorization hook
```

### The ink engine (`lib/inkSim.ts`)

The painted image is a **pure, deterministic function of the stroke list** — so
undo, redo and any redraw are **pixel-identical by construction** (verified: 0
differing pixels after an undo). There is no stateful alpha accumulation to drift.

Each frame the pigment field (`Float32Array` over the sheet) is rebuilt from the
strokes:

1. **Stamp** — every stroke deposits pigment along its centreline with a core +
   bleed falloff. The bleed grows with stroke age (capillary spread that freezes
   when dry), with a ragged, deterministic edge from value noise (paper tooth) and
   a rim term for **edge darkening**.
2. **Drying** — pigment darkness is a deterministic function of stroke age: wet ink
   renders lighter and spreads, then darkens and settles to full richness as it
   dries (`drying speed`, `drying contrast`).
3. **Composite (subtractive optics)** — accumulated pigment density attenuates the
   paper colour per channel via **Beer–Lambert** transmittance (`T = e^(−k·P·a)`),
   not alpha. Dense / overlapping ink converges to a deep, rich black; coloured ink
   keeps its hue. `pigment density`, `ink darkness`, `black point` and `saturation`
   shape the response.

Because pigment is modelled as optical density rather than alpha, overlaps darken
realistically and fully-dried black reaches a true rich black instead of grey.

### Vector preservation

Even as ink spreads organically, the **gesture polyline** is recorded
independently, so the vectorizer detects the intended form and emits clean,
editable cubic-Bézier SVG with minimal anchor points — production-ready for
Illustrator, Figma and Inkscape.

## Features

| Area | Implemented |
|------|-------------|
| Canvas | Physical paper sheet, infinite pan/zoom, grid, snap, radial + mirror symmetry |
| Brush | Pressure sensitivity, stabilization, 5 engines: Ink Bleed · Marker · Pencil · Calligraphy · Rough |
| Ink physics | Bleeding, capillary action, pigment accumulation, edge darkening, drying, pooling, feathering, uneven absorption, live post-stroke evolution |
| Paper | 6 substrates (Bristol · Newsprint · Rice · Handmade · Cardboard · Fabric) + absorbency, roughness, grain, density, fibre direction/strength, wetness, spread resistance |
| InkBleed Lab | Pigment load, **pigment density, ink darkness, saturation, drying contrast, black point**, edge darkening, feathering noise, drying speed, brush water load — all live |
| Pigment optics | Subtractive Beer–Lambert compositing (not alpha): rich blacks, true overlap darkening, deterministic undo/redo |
| Vectorize | RDP, optimized Béziers, minimal anchors, 7 interpretation modes, path-simplification slider |
| Export | SVG · PDF · EPS (true vector) · transparent PNG · 4K PNG — crisp at any scale |
| UI | Dark / light, keyboard shortcuts, live stats |

### Shortcuts

`B` brush · `H` / hold `Space` pan · `0` fit · `V` vector overlay ·
`Ctrl/⌘+Z` undo · `Ctrl/⌘+Shift+Z` redo · scroll = zoom

## Production notes

- TypeScript **strict** mode · no build warnings · no lint errors
- Responsive layout (side panels collapse on small screens)
- Simulation runs on an active-region budget; idle cost ≈ 0
- Optimized SVG output (rounded coords, minimal anchors)

## License

MIT
