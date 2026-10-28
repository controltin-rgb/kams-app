"use client";

import { createContext, useContext } from "react";
import type { OfficeRuntime } from "../agents/runner";

export const RuntimeContext = createContext<OfficeRuntime | null>(null);

export function useRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useRuntime outside <RuntimeContext>");
  return runtime;
}
