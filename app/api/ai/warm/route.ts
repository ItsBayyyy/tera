import { after } from "next/server";
import { warmUpAi } from "@/lib/ai/client";

// The wake-up call runs after the response and may wait out a full cold start.
export const maxDuration = 60;

const MIN_INTERVAL_MS = 60_000;
let lastWarmAt = 0;

/**
 * Called when a scan screen opens. Answers at once and wakes the AI service in the background.
 * Throttled per server instance so repeated calls cannot keep the service (and its credits) busy.
 */
export async function POST() {
  const now = Date.now();
  if (now - lastWarmAt > MIN_INTERVAL_MS) {
    lastWarmAt = now;
    after(() => warmUpAi());
  }
  return new Response(null, { status: 204 });
}
