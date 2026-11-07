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
  await page.getByLabel("Email").fill(`${who}@kenalasu.test`);
  await page.getByLabel("Kata sandi").fill(`${who}-lokal-123`);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/petugas$/);
  await expect(page.getByLabel("Banjar aktif")).toBeVisible();
}

export async function chooseBanjar(page: Page) {
  await page.getByLabel("Banjar aktif").selectOption({ label: `${E2E_BANJAR} · Ubud (contoh)` });
}
