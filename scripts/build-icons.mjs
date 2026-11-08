// Generates every Tera icon from the vector shapes below.
// Run after changing the logo: PLAYWRIGHT_BROWSERS_PATH=0 node scripts/build-icons.mjs
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ACCENT = "#1f4f7a";
const WHITE = "#ffffff";

// Dog head drawn in a 100×100 box; eyes and nose are holes so the background shows through.
const HEAD =
  "M14 4 L35 27 Q50 22 65 27 L86 4 Q91 30 85 47 Q81 58 69 63 L65 83 Q50 98 35 83 L31 63 Q19 58 15 47 Q9 30 14 4 Z " +
  "M37 40 a5 5 0 1 0 0.01 0 Z M63 40 a5 5 0 1 0 0.01 0 Z " +
  "M42 77 Q50 72 58 77 Q56 85 50 86.5 Q44 85 42 77 Z";

const head = (x, y, size) =>
  `<path fill="${WHITE}" fill-rule="evenodd" transform="translate(${x} ${y}) scale(${size / 100})" d="${HEAD}"/>`;

// The check badge is the "tera": the official mark that the dog is registered.
const badge =
  `<circle cx="372" cy="372" r="74" fill="${ACCENT}"/>` +
  `<circle cx="372" cy="372" r="56" fill="${WHITE}"/>` +
  `<path d="M346 373 L364 391 L399 355" fill="none" stroke="${ACCENT}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;

const markWithBadge = head(80, 88, 312) + badge;
const markHeadOnly = head(96, 96, 320);

const svg = (content, { rounded = true, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512"${rounded ? ' rx="112"' : ""} fill="${ACCENT}"/>` +
  (scale === 1 ? content : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${content}</g>`) +
  `</svg>`;

async function render(page, markup, size) {
  const sized = markup.replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${sized}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
}

// ICO with embedded PNGs (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const icon = svg(markWithBadge);
// Maskable icons are cropped to a circle of 80% width, so the mark shrinks to stay inside it.
const maskable = svg(markWithBadge, { rounded: false, scale: 0.72 });
// iOS rounds the corners itself and needs an opaque square.
const apple = svg(markWithBadge, { rounded: false, scale: 0.86 });
// At favicon sizes the badge turns into noise, so the favicon is the head alone.
const favicon = svg(markHeadOnly);

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await writeFile("public/icon.svg", `${icon}\n`);
  await writeFile("public/icon-192.png", await render(page, icon, 192));
  await writeFile("public/icon-512.png", await render(page, icon, 512));
  await writeFile("public/icon-maskable-512.png", await render(page, maskable, 512));
  await writeFile("app/apple-icon.png", await render(page, apple, 180));
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push({ size, png: await render(page, favicon, size) });
  await writeFile("app/favicon.ico", ico(images));
} finally {
  await browser.close();
}
