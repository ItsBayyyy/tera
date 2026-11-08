// Renders docs/proposal/proposal.html to an A4 PDF with Playwright's Chromium.
// Fails when any page overflows its A4 box or the body exceeds the guidebook's 5-page limit.
// Run: npm run proposal   (needs PLAYWRIGHT_BROWSERS_PATH=0 like the e2e tests)
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const SOURCE = path.resolve("docs/proposal/proposal.html");
// Guidebook page 5 recommends AIWIC2026_NamaTim_NamaProduk.pdf; an individual entrant uses their own name.
const OUTPUT = path.resolve("docs/proposal/AIWIC2026_MadeBayuArdanaPutra_Tera.pdf");
const MAX_BODY_PAGES = 5;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // Measure overflow with the same media the PDF is printed with.
  await page.emulateMedia({ media: "print" });
  await page.goto(pathToFileURL(SOURCE).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const report = await page.evaluate(() => {
    const pages = [...document.querySelectorAll(".page")];
    return {
      total: pages.length,
      cover: pages.filter((p) => p.classList.contains("cover")).length,
      appendix: pages.filter((p) => p.classList.contains("appendix")).length,
      fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
      overflow: pages
        .map((p, i) => {
          const content = p.querySelector(".content") ?? p;
          return { page: i + 1, over: content.scrollHeight - content.clientHeight };
        })
        .filter((p) => p.over > 1),
      brokenImages: [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src),
    };
  });

  const body = report.total - report.cover - report.appendix;
  const problems = [];
  if (report.overflow.length) problems.push(`isi meluber: ${report.overflow.map((o) => `halaman ${o.page} (+${o.over}px)`).join(", ")}`);
  if (body > MAX_BODY_PAGES) problems.push(`halaman isi ${body} > ${MAX_BODY_PAGES}`);
  if (report.brokenImages.length) problems.push(`gambar gagal dimuat: ${report.brokenImages.join(", ")}`);
  if (!report.fontsLoaded.includes("Plus Jakarta Sans")) problems.push("font Plus Jakarta Sans tidak termuat");
  if (problems.length) throw new Error(problems.join("\n"));

  await page.pdf({ path: OUTPUT, preferCSSPageSize: true, printBackground: true });
  const { size } = await stat(OUTPUT);
  console.log(
    `${path.relative(process.cwd(), OUTPUT)}: ${report.total} halaman (cover ${report.cover}, isi ${body}, lampiran ${report.appendix}), ${(size / 1024).toFixed(0)} KB`,
  );
} finally {
  await browser.close();
}
