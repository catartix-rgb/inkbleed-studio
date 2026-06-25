"use client";

import { useStudio } from "@/lib/store";
import {
  BrushIcon,
  HandIcon,
  NodeIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
  GridIcon,
  SymmetryIcon,
} from "./Icons";
import type { Tool } from "@/lib/types";

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`btn flex h-10 w-10 items-center justify-center rounded-md ${
        active ? "btn-active" : ""
      }`}
    >
      {children}
    </button>
  );
}

export default function Toolbar() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const clear = useStudio((s) => s.clear);
  const grid = useStudio((s) => s.grid);
  const setGrid = useStudio((s) => s.setGrid);
  const symmetry = useStudio((s) => s.symmetry);
  const setSymmetry = useStudio((s) => s.setSymmetry);
  const strokes = useStudio((s) => s.strokes.length);

  const tools: { id: Tool; icon: React.ReactNode; label: string; key: string }[] = [
    { id: "brush", icon: <BrushIcon />, label: "Brush", key: "B" },
    { id: "pan", icon: <HandIcon />, label: "Pan", key: "H" },
    { id: "node", icon: <NodeIcon />, label: "Node edit", key: "N" },
  ];

  return (
    <div className="flex flex-col items-center gap-2 p-2">
      {tools.map((t) => (
        <ToolButton
          key={t.id}
          active={tool === t.id}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
        >
          {t.icon}
        </ToolButton>
      ))}

      <div className="my-1 h-px w-7 bg-[var(--line)]" />

      <ToolButton onClick={undo} title="Undo (Ctrl+Z)">
        <UndoIcon />
      </ToolButton>
      <ToolButton onClick={redo} title="Redo (Ctrl+Shift+Z)">
        <RedoIcon />
      </ToolButton>
      <ToolButton
        onClick={() => {
          if (strokes > 0 && confirm("Clear the whole canvas?")) clear();
        }}
        title="Clear canvas"
      >
        <TrashIcon />
      </ToolButton>

      <div className="my-1 h-px w-7 bg-[var(--line)]" />

      <ToolButton
        active={grid.visible}
        onClick={() => setGrid({ visible: !grid.visible })}
        title="Toggle grid"
      >
        <GridIcon />
      </ToolButton>
      <ToolButton
        active={symmetry.enabled}
        onClick={() => setSymmetry({ enabled: !symmetry.enabled })}
        title="Symmetry drawing"
      >
        <SymmetryIcon />
      </ToolButton>
    </div>
  );
}
