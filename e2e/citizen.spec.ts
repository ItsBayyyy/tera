import { expect, test, type Page } from "@playwright/test";
import { fixture, installFakeSpeech, login, setAiMode, spokenTexts } from "./helpers";

async function fileReport(page: Page) {
  await page.goto("/darurat");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Digigit anjing");
  await expect(page.getByRole("link", { name: "Telepon 119" })).toHaveAttribute("href", "tel:119");
  await expect(page.getByRole("link", { name: "Telepon 112" })).toHaveAttribute("href", "tel:112");
  await expect(page.getByText("Cuci luka dengan sabun dan air mengalir")).toBeVisible();

  await page.getByRole("button", { name: "Isi laporan singkat" }).click();
  await page.getByText("Tangan atau jari").click();
  await page.locator('input[type="file"]').setInputFiles(fixture("photo-c.jpg"));
  await expect(page.getByAltText("Pratinjau foto anjing")).toBeVisible();
  await page.getByLabel("Nomor HP").fill("0812 3456 7890");
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page.getByText("Centang persetujuan")).toBeVisible();
  await page.getByText("Saya setuju petugas kesehatan").click();
  await page.getByRole("button", { name: "Kirim laporan" }).click();

  await expect(page.getByRole("heading", { name: "Laporan diterima petugas" })).toBeVisible();
  const code = await page.getByTestId("case-code").innerText();
  expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  await expect(page.getByText("Tetap ke puskesmas atau rumah sakit hari ini.")).toBeVisible();
  // Citizens never see anything about the dog or its vaccination status.
  await expect(page.getByText(/Tervaksin|Belum ada catatan vaksin|Kemiripan/)).toHaveCount(0);
  return code;
}

test.describe("citizen emergency flow", () => {
  test.afterAll(async () => {
    await setAiMode("up");
  });

  test("works with AI up and the report reaches the officer queue", async ({ page, browser }) => {
    await setAiMode("up");
    const code = await fileReport(page);

    const officer = await browser.newPage();
    await login(officer);
    await officer.getByRole("link", { name: "Kasus" }).click();
    await officer.getByRole("link", { name: new RegExp(code) }).click();
    await expect(officer.getByRole("heading", { name: code })).toBeVisible();
    await expect(officer.getByText("Saran AI, bukan kepastian.")).toBeVisible();
    await expect(officer.getByRole("link", { name: /0812/ })).toBeVisible();
    await officer.getByRole("button", { name: "Ditangani" }).click();
    await expect(officer.getByText("Status: Ditangani.")).toBeVisible();
  });

  test("still accepts the report when the AI service is down", async ({ page }) => {
    await setAiMode("down");
    await fileReport(page);
  });

  test("the guide still opens offline after a first visit", async ({ page, context }) => {
    await page.goto("/darurat");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("Cuci luka dengan sabun dan air mengalir")).toBeVisible();
    await expect(page.getByRole("link", { name: "Telepon 119" })).toBeVisible();
    await context.setOffline(false);
  });

  test("guides a panicked victim: calm intro, wash timer, nearest clinic", async ({ page }) => {
    await page.clock.install();
    await page.goto("/darurat");
    await expect(page.getByText("Rabies bisa dicegah bila ditangani cepat.")).toBeVisible();

    // The map search needs no facility data, so it works even before admins enter any.
    const maps = page.getByRole("link", { name: "Buka peta puskesmas & rumah sakit terdekat" }).first();
    await expect(maps).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    await expect(maps).toHaveAttribute("target", "_blank");

    await page.getByRole("button", { name: "Mulai timer 15 menit" }).click();
    const timer = page.getByRole("timer", { name: "Sisa waktu mencuci luka" });
    await expect(timer).toHaveText("15:00");
    await page.clock.fastForward("05:00");
    await expect(timer).toHaveText("10:00");
    await page.clock.fastForward("10:01");
    await expect(page.getByRole("status").filter({ hasText: "15 menit selesai" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ulangi timer" })).toBeVisible();
  });

  test("reads the steps aloud with the phone's Indonesian voice", async ({ page }) => {
    await installFakeSpeech(page, ["en-US", "id-ID"]);
    await page.goto("/darurat");

    await page.getByRole("button", { name: "Bacakan langkah" }).click();
    const stop = page.getByRole("button", { name: "Berhenti membacakan" });
    await expect(stop).toBeVisible();
    // The step being read is highlighted, so the reader can glance back at it.
    await expect(page.locator('li[aria-current="step"]')).toContainText("Cuci luka dengan sabun");

    const spoken = await spokenTexts(page);
    expect(spoken[0]).toBe("Rabies bisa dicegah bila ditangani cepat. Ikuti langkah di bawah, satu per satu.");
    expect(spoken[1]).toBe("Langkah 1. Cuci luka dengan sabun dan air mengalir. Lakukan sekitar 15 menit. Ini langkah paling penting.");
    expect(spoken).toHaveLength(6);
    expect(spoken.join(" ")).not.toContain("(VAR)");

    await stop.click();
    await expect(page.getByRole("button", { name: "Bacakan langkah" })).toBeVisible();
    await expect(page.locator('li[aria-current="step"]')).toHaveCount(0);
  });

  test("the wash timer speaks its start, 5-minute reminder and end", async ({ page }) => {
    await installFakeSpeech(page, ["id-ID"]);
    await page.clock.install();
    await page.goto("/darurat");
    await page.getByRole("button", { name: "Mulai timer 15 menit" }).click();
    await page.clock.fastForward("10:01");
    await page.clock.fastForward("05:00");
    await expect(page.getByRole("button", { name: "Ulangi timer" })).toBeVisible();
    expect(await spokenTexts(page)).toEqual([
      "Timer 15 menit dimulai. Terus alirkan air dan sabun ke luka.",
      "5 menit lagi. Terus cuci lukanya.",
      "15 menit selesai. Lanjut ke langkah 2: beri antiseptik.",
    ]);
  });

  test("hides the read-aloud button when the phone has no Indonesian voice", async ({ page }) => {
    await installFakeSpeech(page, ["en-US"]);
    await page.goto("/darurat");
    await expect(page.getByText("Cuci luka dengan sabun dan air mengalir")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bacakan langkah" })).toHaveCount(0);
  });
});
