import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const BrushIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9.5 14.5 4 20" />
    <path d="M14 4c2 2 2 4-1 7l-3 3-3-3 3-3c3-3 5-3 4-4Z" />
    <path d="M4 20c1.5 0 3-.5 3-2.5" />
  </svg>
);

export const HandIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M14 11V5.5a1.5 1.5 0 0 1 3 0V13" />
    <path d="M8 11v-1a1.5 1.5 0 0 0-3 0v4c0 4 2.5 7 6 7s6-2 6-6v-2" />
  </svg>
);

export const NodeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 19C5 11 11 5 19 5" />
    <rect x="3" y="17" width="4" height="4" rx="0.5" />
    <rect x="17" y="3" width="4" height="4" rx="0.5" />
  </svg>
);

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
  </svg>
);

export const RedoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m15 7 5 5-5 5" />
    <path d="M20 12H9a5 5 0 0 0 0 10h1" />
  </svg>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </svg>
);

export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
);

export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10Z" />
  </svg>
);

export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export const SymmetryIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18" strokeDasharray="2 2" />
    <path d="M9 6 4 12l5 6" />
    <path d="m15 6 5 6-5 6" />
  </svg>
);

export const VectorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="4" height="4" />
    <rect x="17" y="3" width="4" height="4" />
    <rect x="3" y="17" width="4" height="4" />
    <rect x="17" y="17" width="4" height="4" />
    <path d="M7 5h10M5 7v10M19 7v10M7 19h10" />
  </svg>
);

export const ExportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
  </svg>
);

export const TargetIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
