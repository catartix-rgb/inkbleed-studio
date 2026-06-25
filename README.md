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

### The five brushes (`lib/inkSim.ts`)

Each tool has its own stroke generation, pressure response, pigment behaviour,
paper coupling, drying and vectorization — drawn with the same line they are
immediately distinguishable, even in black and white:

- **Ink Bleed** — liquid India ink. Soft round nib, capillary bleed that grows
  with paper absorbency and freezes when dry, feathered + darkened rim, rich black.
- **Marker** — Copic felt-tip. Flat saturated coverage, crisp edges, faint dry
  streaks, pressure drives width far more than opacity, fast drying, layered overlaps.
- **Pencil** — graphite. Deposits only on the raised paper tooth (natural gaps),
  pressure controls darkness, reads as desaturated grey, tilt → broad light shading.
- **Calligraphy** — flat broad nib. Width = nib projection onto the travel
  direction (thin parallel, thick across), chiselled ends, pooling on direction
  changes, adjustable nib rotation.
- **Rough Brush** — dry brush. Separate bristle tracks that lift off the paper,
  broken edges, missing-pigment gaps, uneven pressure response.

### Dual export — Faithful vs Clean (`lib/exporter.ts`, `lib/trace.ts`)

The canvas is the source of truth. **Faithful Ink Export** marching-squares-traces
the *actual rendered ink coverage field* (the same one shown on screen) into
vector paths, so edge irregularities, bleeding, dry-brush gaps, marker streaks,
pressure variation and calligraphic contrast survive — the SVG looks like the
artwork, not a generic smooth curve (it emits dense polyline texture + tonal
bands, higher node count by design). **Clean Logo Export** uses the optimized
Bézier outliner (minimal anchors) for a geometric mark. Both lay out onto the
chosen artboard at real-world size and export to SVG / PDF / EPS / PNG.

**Logo Master Export** runs once and produces a full package (faithful SVG,
clean SVG, print PDF, transparent PNG, monochrome, inverted, outlined, EPS
source + README) as a single dependency-free `.zip`.

### Vector preservation

Even as ink spreads organically, the **gesture polyline** is recorded
independently, so the vectorizer detects the intended form and emits clean,
editable cubic-Bézier SVG with minimal anchor points — production-ready for
Illustrator, Figma and Inkscape.

## Features

| Area | Implemented |
|------|-------------|
| Canvas | Physical paper sheet, infinite pan/zoom, grid, snap, radial + mirror symmetry |
| Brush | Pressure + tilt sensitivity, stabilization, 5 physically distinct engines (see below) |
| Ink physics | Bleeding, capillary action, pigment accumulation, edge darkening, drying, pooling, feathering, uneven absorption, live post-stroke evolution |
| Paper | 6 substrates (Bristol · Newsprint · Rice · Handmade · Cardboard · Fabric) + absorbency, roughness, grain, density, fibre direction/strength, wetness, spread resistance |
| InkBleed Lab | Pigment load, **pigment density, ink darkness, saturation, drying contrast, black point**, edge darkening, feathering noise, drying speed, brush water load — all live |
| Pigment optics | Subtractive Beer–Lambert compositing (not alpha): rich blacks, true overlap darkening, deterministic undo/redo |
| Vectorize | RDP, optimized Béziers, minimal anchors, 7 interpretation modes, path-simplification slider |
| Artboard | Presets (A0–A6, Letter/Legal/Tabloid, social, Poster, Billboard) + custom W/H in px/mm/cm/in, 72–1200 DPI |
| Export | Dual engine — Faithful Ink (traces real ink) or Clean Logo (optimized Bézier) · SVG / PDF / EPS / transparent PNG / DPI PNG · Logo Master ZIP bundle |
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
