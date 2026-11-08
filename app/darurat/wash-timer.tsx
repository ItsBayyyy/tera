"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { WASH_MINUTES } from "@/content/first-aid";
import { formatCountdown } from "@/lib/format";

const DURATION_MS = WASH_MINUTES * 60_000;

type State = { kind: "idle" } | { kind: "running"; endsAt: number } | { kind: "done" };

/** Keeps the screen on while the timer runs, so wet hands do not have to unlock the phone. */
function useScreenAwake(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {});
    // The browser drops the lock when the tab is hidden; take it again when the reader comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** Countdown for the wound wash. Uses the end time, not tick counts, so throttled tabs stay accurate. */
export function WashTimer() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [now, setNow] = useState(0);
  useScreenAwake(state.kind === "running");

  useEffect(() => {
    if (state.kind !== "running") return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= state.endsAt) {
        setState({ kind: "done" });
        navigator.vibrate?.([300, 150, 300]);
      }
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  function start() {
    const current = Date.now();
    setNow(current);
    setState({ kind: "running", endsAt: current + DURATION_MS });
  }

  const remaining = state.kind === "running" ? Math.max(0, state.endsAt - now) : DURATION_MS;
  const progress = 100 - Math.round((remaining / DURATION_MS) * 100);

  return (
    <div className="mt-3">
      {/* Always mounted, so screen readers announce the message the moment it appears. */}
      <div role="status">
        {state.kind === "done" ? (
          <p className="mb-3 rounded-xl bg-ok-soft p-4 font-semibold text-ok">
            {WASH_MINUTES} menit selesai. Lanjut ke langkah 2: beri antiseptik.
          </p>
        ) : null}
      </div>
      {state.kind === "running" ? (
        <div className="rounded-xl bg-accent-soft p-4">
          <p role="timer" aria-label="Sisa waktu mencuci luka" className="tabular text-center text-5xl font-bold text-accent">
            {formatCountdown(remaining)}
          </p>
          <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-center text-ink">Terus alirkan air dan sabun ke luka. Layar dibiarkan menyala.</p>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="mt-3 min-h-12 w-full rounded-xl font-semibold text-ink-muted hover:bg-surface"
          >
            Hentikan timer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-accent bg-surface px-4 font-semibold text-accent hover:bg-accent-soft"
        >
          <Timer aria-hidden="true" className="size-5 shrink-0" />
          {state.kind === "done" ? "Ulangi timer" : `Mulai timer ${WASH_MINUTES} menit`}
        </button>
      )}
    </div>
  );
}
