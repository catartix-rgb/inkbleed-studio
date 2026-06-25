"use client";

import { useMemo } from "react";
import { useStudio } from "./store";
import { getMode } from "./modes";
import { vectorize, type VectorResult } from "./vectorize";

/** Memoized vectorization of the current sketch under the active mode. */
export function useVector(): { result: VectorResult; color: string } {
  const strokes = useStudio((s) => s.strokes);
  const modeId = useStudio((s) => s.mode);
  const detail = useStudio((s) => s.vectorDetail);
  const revision = useStudio((s) => s.revision);
  const theme = useStudio((s) => s.theme);

  const result = useMemo(() => {
    const base = getMode(modeId);
    const mode = { ...base, simplify: base.simplify * detail };
    return vectorize(strokes, mode);
    // revision captures stroke/mode/detail mutations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, modeId, detail]);

  const color = theme === "dark" ? "#f2f2ee" : "#0a0a0a";
  return { result, color };
}
