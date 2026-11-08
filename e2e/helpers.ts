import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

export const fixture = (name: string) => path.join(__dirname, "fixtures", name);
export const E2E_BANJAR = "Banjar Contoh 3";

export async function setAiMode(mode: "up" | "down") {
  await fetch("http://127.0.0.1:8010/__mode", { method: "POST", body: JSON.stringify({ mode }) });
}

export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/** Removes dogs that earlier e2e runs left in the e2e banjar so the first scan starts from an empty gallery. */
export async function resetE2eBanjar() {
  const db = serviceClient();
  const { data: banjar } = await db.from("banjars").select("id").eq("name", E2E_BANJAR).single();
  const { data: dogs } = await db.from("dogs").select("id, dog_photos(storage_path)").eq("banjar_id", banjar!.id);
  const paths = (dogs ?? []).flatMap((d: { dog_photos: { storage_path: string }[] }) => d.dog_photos.map((p) => p.storage_path));
  if (paths.length) await db.storage.from("dog-photos").remove(paths);
  if (dogs?.length) await db.from("dogs").delete().in("id", dogs.map((d: { id: string }) => d.id));
  return banjar!.id as string;
}

export async function login(page: Page, who: "petugas" | "admin" = "petugas") {
  await page.goto("/masuk?lanjut=/petugas");
  await page.getByLabel("Email").fill(`${who}@tera.test`);
  await page.getByLabel("Kata sandi").fill(`${who}-lokal-123`);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/petugas$/);
  await expect(page.getByLabel("Banjar aktif")).toBeVisible();
}

export async function chooseBanjar(page: Page) {
  await page.getByLabel("Banjar aktif").selectOption({ label: `${E2E_BANJAR} · Ubud (contoh)` });
}

/**
 * Headless Chromium ships no Indonesian voice, so tests swap in a fake speech engine that records
 * what would be said and plays each utterance for `utteranceMs`. Utterance number `holdAt` (0-based)
 * never finishes, which freezes the UI mid-reading for screenshots.
 */
export async function installFakeSpeech(page: Page, voiceLangs: string[], utteranceMs = 300, holdAt = -1) {
  await page.addInitScript(({ langs, ms, hold }: { langs: string[]; ms: number; hold: number }) => {
    type FakeUtterance = { text: string; onstart: (() => void) | null; onend: (() => void) | null };
    const spoken: string[] = [];
    let queue: FakeUtterance[] = [];
    let playing = false;
    let started = 0;
    const playNext = () => {
      const next = queue.shift();
      playing = Boolean(next);
      if (!next) return;
      next.onstart?.();
      if (started++ === hold) return;
      setTimeout(() => {
        next.onend?.();
        playNext();
      }, ms);
    };
    class Utterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, "__spoken", { value: spoken });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => langs.map((lang) => ({ lang, name: `Uji ${lang}`, default: false, localService: true, voiceURI: lang })),
        speak: (utterance: FakeUtterance) => {
          spoken.push(utterance.text);
          queue.push(utterance);
          if (!playing) playNext();
        },
        cancel: () => {
          queue = [];
          playing = false;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  }, { langs: voiceLangs, ms: utteranceMs, hold: holdAt });
}

export function spokenTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice());
}
