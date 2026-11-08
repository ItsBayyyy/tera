"use client";

import { useEffect, useState } from "react";

/** Picks an Indonesian voice installed on the device; null when there is none. */
export function findIndonesianVoice<T extends { lang: string }>(voices: readonly T[]): T | null {
  const normalized = (lang: string) => lang.toLowerCase().replace("_", "-");
  return (
    voices.find((voice) => normalized(voice.lang) === "id-id") ??
    voices.find((voice) => normalized(voice.lang).startsWith("id")) ??
    null
  );
}

/** Text as it should be spoken: abbreviations in brackets ("(VAR)") are dropped, they read badly aloud. */
export function toSpeech(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/**
 * The device's Indonesian voice, or null while voices load or when the device has none.
 * Voices arrive asynchronously in most browsers, so this listens for `voiceschanged`.
 */
export function useIndonesianVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => setVoice(findIndonesianVoice(window.speechSynthesis.getVoices()));
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  return voice;
}

/** Queues one utterance with the given voice. Speech only ever starts from a user action. */
export function speak(
  text: string,
  voice: SpeechSynthesisVoice,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): void {
  const utterance = new SpeechSynthesisUtterance(toSpeech(text));
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.95;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(utterance);
}
