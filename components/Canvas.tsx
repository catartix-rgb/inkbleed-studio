"use client";

import { useEffect, useRef, useCallback } from "react";
import { useStudio } from "@/lib/store";
import { renderStroke } from "@/lib/brushEngine";
import { InkSim } from "@/lib/inkSim";
import { SHEET_W, SHEET_H, SIM_W, SIM_H } from "@/lib/sheet";
import type { Point, Stroke } from "@/lib/types";

let strokeCounter = 0;
const newId = () => `s${Date.now().toString(36)}_${strokeCounter++}`;

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(true);
  const current = useRef<Stroke | null>(null);
  const drawingId = useRef<number | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const spaceDown = useRef(false);
  const animatingPrev = useRef(false);

  const sim = useRef<InkSim | null>(null);
  const simCanvas = useRef<HTMLCanvasElement | null>(null);
  const lastPaperRev = useRef(-1);

  const markDirty = () => (dirty.current = true);

  const toWorld = useCallback((sx: number, sy: number) => {
    const { viewport } = useStudio.getState();
    return {
      x: (sx - viewport.x) / viewport.scale,
      y: (sy - viewport.y) / viewport.scale,
    };
  }, []);

  // ---- one-time sim setup ----
  useEffect(() => {
    const s = new InkSim(SIM_W, SIM_H);
    const st = useStudio.getState();
    s.setInk(st.ink);
    s.setPaper(st.paper);
    sim.current = s;
    const off = document.createElement("canvas");
    off.width = SIM_W;
    off.height = SIM_H;
    simCanvas.current = off;
    lastPaperRev.current = st.paperRevision;
    const wrap = wrapRef.current;
    if (wrap) {
      const scale = Math.min(
        (wrap.clientWidth * 0.86) / SHEET_W,
        (wrap.clientHeight * 0.9) / SHEET_H
      );
      st.setViewport({
        scale,
        x: (wrap.clientWidth - SHEET_W * scale) / 2,
        y: (wrap.clientHeight - SHEET_H * scale) / 2,
      });
    }
    markDirty();
  }, []);

  // ---- render loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const wrap = wrapRef.current!;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = wrap.clientWidth + "px";
      canvas.style.height = wrap.clientHeight + "px";
      (canvas as any)._dpr = dpr;
      markDirty();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const render = () => {
      raf = requestAnimationFrame(render);
      const st = useStudio.getState();
      const s = sim.current;

      if (s && st.paperRevision !== lastPaperRev.current) {
        s.setPaper(st.paper);
        lastPaperRev.current = st.paperRevision;
        markDirty();
      }
      if (s) s.setInk(st.ink);

      const drawing = !!current.current;
      if (!dirty.current && !animatingPrev.current && !drawing) return;
      dirty.current = false;

      const dpr = (canvas as any)._dpr || 1;
      const css = getComputedStyle(document.body);
      const bg = css.getPropertyValue("--bg").trim() || "#fafaf8";
      const dotColor = css.getPropertyValue("--canvas-dot").trim() || "#ddd";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(st.viewport.x, st.viewport.y);
      ctx.scale(st.viewport.scale, st.viewport.scale);

      // paper sheet with soft drop shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 30 / st.viewport.scale;
      ctx.shadowOffsetY = 8 / st.viewport.scale;
      ctx.fillStyle = st.simEnabled ? st.paper.color : "#ffffff";
      ctx.fillRect(0, 0, SHEET_W, SHEET_H);
      ctx.restore();

      if (s && st.simEnabled) {
        const live: Stroke[] = [];
        if (current.current) {
          live.push(current.current);
          if (st.symmetry.enabled)
            live.push(...symmetryStrokes(current.current, st.symmetry));
        }
        const { image, animating } = s.render(
          st.strokes,
          live,
          performance.now()
        );
        animatingPrev.current = animating;
        const off = simCanvas.current!;
        off.getContext("2d")!.putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(off, 0, 0, SIM_W, SIM_H, 0, 0, SHEET_W, SHEET_H);
      } else {
        animatingPrev.current = false;
        for (const stroke of st.strokes) renderStroke(ctx, stroke);
        if (current.current) renderStroke(ctx, current.current);
      }

      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1 / st.viewport.scale;
      ctx.strokeRect(0, 0, SHEET_W, SHEET_H);

      drawGrid(ctx, st, dotColor);
      if (st.symmetry.enabled) drawSymmetryGuides(ctx, st, css);
    };
    raf = requestAnimationFrame(render);

    const unsub = useStudio.subscribe(markDirty);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
    };
  }, []);

  // ---- pointer handlers ----
  const onPointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const st = useStudio.getState();
    const wantPan =
      st.tool === "pan" || spaceDown.current || e.button === 1 || e.button === 2;

    const capture = () => {
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers can't be captured */
      }
    };

    if (wantPan) {
      panning.current = { x: sx - st.viewport.x, y: sy - st.viewport.y };
      capture();
      return;
    }
    if (st.tool !== "brush") return;

    drawingId.current = e.pointerId;
    capture();
    const w = toWorld(sx, sy);
    const pt: Point = {
      x: snap(w.x, st),
      y: snap(w.y, st),
      p: pressure(e),
      t: performance.now(),
      ...tilt(e),
    };
    current.current = {
      id: newId(),
      points: [pt],
      color: st.color,
      brush: { ...st.brush },
      createdAt: performance.now(),
    };
    markDirty();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (panning.current) {
      useStudio.getState().setViewport({
        x: sx - panning.current.x,
        y: sy - panning.current.y,
      });
      return;
    }
    if (drawingId.current !== e.pointerId || !current.current) return;
    const st = useStudio.getState();
    const coalesced = (e.nativeEvent as any).getCoalescedEvents?.() as
      | PointerEvent[]
      | undefined;
    const events = coalesced && coalesced.length ? coalesced : [e.nativeEvent];
    for (const ce of events) {
      const cw = toWorld(ce.clientX - rect.left, ce.clientY - rect.top);
      current.current.points.push({
        x: snap(cw.x, st),
        y: snap(cw.y, st),
        p: pressure(ce),
        t: performance.now(),
        ...tilt(ce),
      });
    }
    markDirty();
  };

  const endStroke = (e: React.PointerEvent) => {
    if (panning.current) {
      panning.current = null;
      return;
    }
    if (drawingId.current !== e.pointerId || !current.current) return;
    const st = useStudio.getState();
    const cur = current.current;
    drawingId.current = null;
    current.current = null;
    if (cur.points.length === 0) return;
    st.addStroke(cur);
    if (st.symmetry.enabled) {
      for (const copy of symmetryStrokes(cur, st.symmetry)) st.addStroke(copy);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const st = useStudio.getState();
    const factor = Math.exp(-e.deltaY * 0.0014);
    const next = Math.min(20, Math.max(0.08, st.viewport.scale * factor));
    const wx = (sx - st.viewport.x) / st.viewport.scale;
    const wy = (sy - st.viewport.y) / st.viewport.scale;
    st.setViewport({ scale: next, x: sx - wx * next, y: sy - wy * next });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (e.code === "Space") spaceDown.current = true;
      const st = useStudio.getState();
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if (
        meta &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        st.redo();
      } else if (e.key === "b") st.setTool("brush");
      else if (e.key === "h") st.setTool("pan");
      else if (e.key === "0") st.resetView();
      else if (e.key === "v") st.toggleVector();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="block h-full w-full cursor-crosshair"
      />
    </div>
  );
}

// ---- helpers ----
function pressure(e: { pressure?: number; pointerType?: string }) {
  const p = e.pressure ?? 0;
  if (!p || (e.pointerType === "mouse" && p === 0.5)) return 0.5;
  return Math.max(0.05, Math.min(1, p));
}

function tilt(e: { tiltX?: number; tiltY?: number }): { tx: number; ty: number } {
  // tiltX/tiltY are degrees in [-90,90]; normalize to [-1,1]
  return {
    tx: Math.max(-1, Math.min(1, (e.tiltX ?? 0) / 90)),
    ty: Math.max(-1, Math.min(1, (e.tiltY ?? 0) / 90)),
  };
}

function snap(v: number, st: ReturnType<typeof useStudio.getState>) {
  if (st.grid.snap && st.grid.size > 0)
    return Math.round(v / st.grid.size) * st.grid.size;
  return v;
}

function symmetryStrokes(
  stroke: Stroke,
  sym: { axes: number; mirror: boolean }
): Stroke[] {
  const copies: Stroke[] = [];
  let idx = 0;
  const transformAll = (fn: (x: number, y: number) => { x: number; y: number }) => ({
    ...stroke,
    id: stroke.id + "_sym" + idx++,
    points: stroke.points.map((p) => ({ ...p, ...fn(p.x, p.y) })),
  });
  const cx = SHEET_W / 2;
  const cy = SHEET_H / 2;
  const axes = Math.max(1, sym.axes);
  for (let a = 0; a < axes; a++) {
    const ang = (a / axes) * Math.PI * 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    if (a > 0)
      copies.push(
        transformAll((x, y) => {
          const px = x - cx;
          const py = y - cy;
          return { x: cx + (px * cos - py * sin), y: cy + (px * sin + py * cos) };
        })
      );
    if (sym.mirror)
      copies.push(
        transformAll((x, y) => {
          const px = x - cx;
          const py = y - cy;
          const rx = px * cos + py * sin;
          const ry = -px * sin + py * cos;
          const mx = -rx;
          return { x: cx + (mx * cos - ry * sin), y: cy + (mx * sin + ry * cos) };
        })
      );
  }
  return copies;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  st: ReturnType<typeof useStudio.getState>,
  dotColor: string
) {
  if (!st.grid.visible) return;
  const size = st.grid.size;
  ctx.save();
  ctx.fillStyle = dotColor;
  const r = 1 / st.viewport.scale;
  for (let x = 0; x <= SHEET_W; x += size) {
    for (let y = 0; y <= SHEET_H; y += size) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  st: ReturnType<typeof useStudio.getState>,
  css: CSSStyleDeclaration
) {
  const accent = css.getPropertyValue("--accent").trim() || "#ff4d2e";
  const cx = SHEET_W / 2;
  const cy = SHEET_H / 2;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1 / st.viewport.scale;
  const len = Math.max(SHEET_W, SHEET_H);
  const axes = Math.max(1, st.symmetry.axes);
  for (let a = 0; a < axes; a++) {
    const ang = (a / axes) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}
