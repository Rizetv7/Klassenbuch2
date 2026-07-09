"use client";

import { useEffect, useState } from "react";
import type { DesignId } from "./themes";
import { storedDesign } from "./theme";

// Which design is active right now. Resolves after mount (SSR-safe) and
// follows live switches from the design picker.
export function useDesign(): DesignId {
  const [design, setDesign] = useState<DesignId>("aquarell");
  useEffect(() => {
    const sync = () => setDesign(storedDesign());
    sync();
    window.addEventListener("mz-theme-change", sync);
    return () => window.removeEventListener("mz-theme-change", sync);
  }, []);
  return design;
}
