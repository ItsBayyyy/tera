// Captures the proposal's AI result screenshots from /demo against the REAL AI service, so every
// score in the proposal comes from the actual model (the e2e screenshots use a mock AI).
// Needs: a running app (e.g. `npx next start -p 3300`) wired to a running ai-service and seeded demo data.
// Run: PLAYWRIGHT_BROWSERS_PATH=0 node scripts/capture-proposal-screens.mjs [base-url]
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3300";
const OUT = "docs/proposal/img";
// Public-domain street dog from Wikimedia Commons (data/samples/SOURCES.json); not in the demo gallery.
const UNREGISTERED_DOG = "data/samples/dog_street_gianyar.jpg";
// The third test photo belongs to a seeded demo dog.
const PROBE_INDEX = 2;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

try {
  await page.goto(`${BASE}/demo`);
  const probes = page.getByRole("region", { name: "Foto uji (belum didaftarkan)" });
  await probes.getByRole("button", { name: "Cocokkan" }).nth(PROBE_INDEX).click();
  await page.getByText("Jawaban sebenarnya").waitFor({ timeout: 60_000 });
  await probes.locator('div[aria-live="polite"]').screenshot({ path: `${OUT}/demo-dikenali.png` });
  // Full phone screen of the same result, for the cover mockup.
  await page.getByRole("heading", { name: "Sangat mirip" }).evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -24);
  });
  await page.screenshot({ path: `${OUT}/demo-layar.png` });

  await page.goto(`${BASE}/demo`);
  const tryIt = page.getByRole("region", { name: "Coba dengan foto Anda" });
  // Second camera input = "Foto B" (match only, nothing is registered).
  await tryIt.getByTestId("photo-input").nth(1).setInputFiles(UNREGISTERED_DOG);
  await tryIt.getByText(/Tidak ada yang cocok|Belum ada yang cocok|tidak cocok/i).first().waitFor({ timeout: 60_000 });
  await tryIt.locator("div.space-y-4").last().screenshot({ path: `${OUT}/demo-tidak-cocok.png` });
} finally {
  await browser.close();
}
