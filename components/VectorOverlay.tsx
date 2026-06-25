"use client";

import { useStudio } from "@/lib/store";
import { useVector } from "@/lib/useVector";

/**
 * Renders the live vector output as an SVG overlay, transformed to match the
 * canvas viewport so anchors line up 1:1 with the underlying sketch.
 */
export default function VectorOverlay() {
  const show = useStudio((s) => s.showVector);
  const viewport = useStudio((s) => s.viewport);
  const showSketch = useStudio((s) => s.showSketchUnderVector);
  const { result, color } = useVector();

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {!showSketch && (
        <div
          className="absolute inset-0"
          style={{ background: "var(--canvas)", opacity: 0.92 }}
        />
      )}
      <svg className="absolute inset-0 h-full w-full" style={{ color }}>
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
        >
          {result.paths.map((p) => (
            <path key={p.id} d={p.d} fill={p.fill} fillRule="nonzero" />
          ))}
          {/* anchor dots for the node-editing feel */}
          {viewport.scale > 0.5 &&
            result.paths.flatMap((p) =>
              anchorsOf(p.d).map((a, i) => (
                <circle
                  key={p.id + i}
                  cx={a.x}
                  cy={a.y}
                  r={2.5 / viewport.scale}
                  fill="var(--accent)"
                  opacity={0.85}
                />
              ))
            )}
        </g>
      </svg>
    </div>
  );
}

function anchorsOf(d: string): { x: number; y: number }[] {
  // anchor points are the endpoint of each command (M and each C)
  const out: { x: number; y: number }[] = [];
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i++];
    if (t === "M") out.push({ x: +tokens[i++], y: +tokens[i++] });
    else if (t === "C") {
      i += 4;
      out.push({ x: +tokens[i++], y: +tokens[i++] });
    }
  }
  return out;
}
