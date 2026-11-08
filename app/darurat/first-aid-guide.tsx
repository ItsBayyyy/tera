"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { FIRST_AID_INTRO, FIRST_AID_STEPS } from "@/content/first-aid";
import { speak, useIndonesianVoice } from "@/lib/speech";
import { NearbyCareLink } from "./nearby-care-link";
import { WashTimer } from "./wash-timer";

/** null = not reading; -1 = the intro; 0..n = a step. */
type Reading = number | null;

/**
 * Numbered first-aid steps with an optional "read aloud" mode for people whose hands and eyes are
 * busy with the wound. Speech uses the phone's own Indonesian voice (no network, no third party)
 * and the exact on-screen text, so nothing new needs medical review. The button only appears when
 * the device has an Indonesian voice.
 */
export function FirstAidGuide() {
  const voice = useIndonesianVoice();
  const [reading, setReading] = useState<Reading>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Stop talking when the reader leaves the page.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function stop() {
    window.speechSynthesis.cancel();
    setReading(null);
  }

  function readAloud() {
    if (!voice) return;
    window.speechSynthesis.cancel();
    setReading(-1);
    speak(FIRST_AID_INTRO, voice, { onStart: () => setReading(-1) });
    FIRST_AID_STEPS.forEach((step, index) => {
      const isLast = index === FIRST_AID_STEPS.length - 1;
      speak(`Langkah ${index + 1}. ${step.title}. ${step.detail}`, voice, {
        onStart: () => {
          setReading(index);
          stepRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
        },
        onEnd: isLast ? () => setReading(null) : undefined,
      });
    });
  }

  return (
    <>
      {voice ? (
        <button
          type="button"
          onClick={reading === null ? readAloud : stop}
          aria-pressed={reading !== null}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-accent bg-surface px-4 font-semibold text-accent hover:bg-accent-soft"
        >
          {reading === null ? (
            <>
              <Volume2 aria-hidden="true" className="size-5 shrink-0" />
              Bacakan langkah
            </>
          ) : (
            <>
              <Square aria-hidden="true" className="size-4 shrink-0 fill-current" />
              Berhenti membacakan
            </>
          )}
        </button>
      ) : null}

      <ol className="mt-6 space-y-3" aria-label="Langkah pertolongan pertama">
        {FIRST_AID_STEPS.map((step, index) => (
          <li
            key={step.title}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
            aria-current={reading === index ? "step" : undefined}
            className="flex gap-4 rounded-card border border-line bg-surface p-4 transition-colors aria-[current=step]:border-accent aria-[current=step]:bg-accent-soft aria-[current=step]:ring-2 aria-[current=step]:ring-accent"
          >
            <span
              aria-hidden="true"
              className="tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-snug">{step.title}</p>
              <p className="mt-1 text-ink-muted">{step.detail}</p>
              {"action" in step && step.action === "wash-timer" ? <WashTimer /> : null}
              {"action" in step && step.action === "nearby-care" ? <NearbyCareLink /> : null}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
