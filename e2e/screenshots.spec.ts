/**
 * Visual review loop (build prompt §8): full-page screenshots of every page and main state at
 * 360 px and 1280 px, written to docs/screenshots/. Run on demand:
 *   SCREENSHOTS=1 PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/screenshots.spec.ts
 * Uses public-domain sample photos from data/samples/ when present (see docs/AI.md), else the
 * synthetic fixtures.
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { chooseBanjar, fixture, installFakeSpeech, login, resetE2eBanjar, serviceClient, setAiMode } from "./helpers";

test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to refresh docs/screenshots");
test.describe.configure({ mode: "serial" });

const OUT = path.join(__dirname, "..", "docs", "screenshots");
const sample = (name: string, fallback: string) => {
  const file = path.join(__dirname, "..", "data", "samples", name);
  return existsSync(file) ? file : fixture(fallback);
};
const PHOTO_A = sample("dog_kintamani_white.jpg", "photo-a.jpg");
const PHOTO_B = sample("dog_street_gianyar.jpg", "photo-b.jpg");

const VIEWPORTS = [
  { name: "360", width: 360, height: 780 },
  { name: "1280", width: 1280, height: 800 },
] as const;

async function shot(page: Page, name: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${name}-${vp.name}.png`), fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 360, height: 780 });
}

let original = { strong: 0.667, unsure: 0.39 };

async function readThresholds() {
  const { data } = await serviceClient().from("app_config").select("key, value");
  const map = new Map((data ?? []).map((row: { key: string; value: unknown }) => [row.key, Number(row.value)]));
  return { strong: map.get("match_strong") ?? original.strong, unsure: map.get("match_unsure") ?? original.unsure };
}

async function setThresholds(strong: number, unsure: number) {
  const db = serviceClient();
  await db.from("app_config").update({ value: strong }).eq("key", "match_strong");
  await db.from("app_config").update({ value: unsure }).eq("key", "match_unsure");
}

test.beforeAll(async () => {
  original = await readThresholds();
  await setAiMode("up");
  await resetE2eBanjar();
});

test.afterAll(async () => {
  await setThresholds(original.strong, original.unsure);
  await setAiMode("up");
});

test("citizen pages", async ({ page }) => {
  await page.goto("/");
  await shot(page, "01-beranda");
  // Look of a phone that has an Indonesian voice (headless Chromium has none, so the button would hide).
  await installFakeSpeech(page, ["id-ID"], 200, 1);
  await page.goto("/darurat");
  await shot(page, "02-darurat");
  await page.getByRole("button", { name: "Bacakan langkah" }).click();
  await page.getByRole("button", { name: "Berhenti membacakan" }).waitFor();
  await page.locator('li[aria-current="step"]').waitFor();
  await shot(page, "02b-darurat-dibacakan");
  await page.getByRole("button", { name: "Berhenti membacakan" }).click();
  await page.getByRole("button", { name: "Isi laporan singkat" }).click();
  await shot(page, "03-darurat-form");
  await page.getByText("Tangan atau jari").click();
  await page.getByLabel("Nomor HP").fill("0812");
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page.getByText("Nomor HP tidak valid")).toBeVisible();
  await shot(page, "04-darurat-form-error");
  await page.getByLabel("Nomor HP").fill("");
  await page.locator('input[type="file"]').setInputFiles(PHOTO_B);
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page.getByRole("heading", { name: "Laporan diterima petugas" })).toBeVisible();
  await shot(page, "05-darurat-diterima");
});

test("login", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByRole("button", { name: "Masuk" }).click();
  await shot(page, "06-masuk-error");
});

test("officer scan states", async ({ page }) => {
  await login(page, "admin");
  await chooseBanjar(page);
  await shot(page, "07-petugas-kosong");

  await page.getByRole("link", { name: "Scan anjing" }).click();
  await shot(page, "08-scan-awal");
  await page.getByTestId("photo-input").setInputFiles(PHOTO_A);
  await expect(page.getByText("Foto bisa dipakai")).toBeVisible();
  await shot(page, "09-scan-foto-ok");
  await page.getByRole("button", { name: /Cari kecocokan/ }).click();
  await expect(page.getByRole("heading", { name: "Tidak ada yang mirip" })).toBeVisible();
  await shot(page, "10-hasil-tidak-cocok");
  await page.getByRole("button", { name: "Daftarkan anjing baru" }).click();
  await page.getByRole("button", { name: "Simpan anjing" }).click();
  await expect(page.getByText("Isi warna bulu.")).toBeVisible();
  await shot(page, "11-daftar-error");
  await page.getByLabel("Warna bulu").fill("Putih krem");
  await page.getByLabel("Nama panggilan").fill("Putih");
  await page.getByRole("button", { name: "Simpan anjing" }).click();
  await expect(page.getByRole("heading", { name: "Anjing terdaftar" })).toBeVisible();
  await shot(page, "12-catat-vaksin");
  await page.getByRole("button", { name: "Catat vaksin" }).click();
  await expect(page.getByText("Vaksin tercatat")).toBeVisible();
  await shot(page, "13-selesai");

  await page.getByRole("button", { name: "Scan anjing berikutnya" }).click();
  await expect(page.getByRole("heading", { name: "Foto wajah anjing" })).toBeVisible();
  await page.getByTestId("photo-input").setInputFiles(PHOTO_A);
  await expect(page.getByText("Foto bisa dipakai")).toBeVisible();
  await page.getByRole("button", { name: /Cari kecocokan/ }).click();
  await expect(page.getByRole("heading", { name: "Sangat mirip" })).toBeVisible();
  await shot(page, "14-hasil-kuat");

  // The mock gives unrelated photos a similarity near 0, so lower the thresholds to show the unsure zone.
  await setThresholds(0.9, -0.5);
  await page.goto("/petugas/scan");
  await page.getByTestId("photo-input").setInputFiles(PHOTO_B);
  await expect(page.getByText("Foto bisa dipakai")).toBeVisible();
  await page.getByRole("button", { name: /Cari kecocokan/ }).click();
  await expect(page.getByRole("heading", { name: "Ragu: periksa manual" })).toBeVisible();
  await shot(page, "15-hasil-ragu");
  await setThresholds(original.strong, original.unsure);

  await setAiMode("down");
  await page.goto("/petugas/scan");
  await page.getByTestId("photo-input").setInputFiles(PHOTO_B);
  await expect(page.getByText("AI sedang tidak tersedia.")).toBeVisible();
  await shot(page, "16-scan-ai-mati");
  await setAiMode("up");

  await page.goto("/petugas");
  await expect(page.getByRole("link", { name: /Putih/ })).toBeVisible();
  await shot(page, "17-petugas-daftar");
  await page.getByRole("link", { name: /Putih/ }).click();
  await expect(page.getByRole("heading", { name: "Riwayat vaksin" })).toBeVisible();
  await shot(page, "18-detail-anjing");

  await page.goto("/petugas/kasus");
  await expect(page.getByText("Pembaruan langsung aktif")).toBeVisible();
  await shot(page, "19-kasus");
  await page.locator('a[href^="/petugas/kasus/"]').first().click();
  await expect(page.getByText("Saran AI, bukan kepastian.")).toBeVisible();
  await shot(page, "20-detail-kasus");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Cakupan vaksin per banjar" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await shot(page, "21-admin");
});

test("demo", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Anjing terdaftar di banjar DEMO" })).toBeVisible();
  await shot(page, "22-demo");
});
