"use client";

import { useEffect } from "react";

/** Asks the server to wake the AI service as soon as a screen that will need it opens. */
export function useWarmAi() {
  useEffect(() => {
    void fetch("/api/ai/warm", { method: "POST" }).catch(() => {});
  }, []);
}
