import { expect, test } from "@playwright/test";
import { chooseBanjar, fixture, login, resetE2eBanjar, setAiMode } from "./helpers";

test.describe("officer flow with AI (mocked)", () => {
  test.beforeAll(async () => {
    await setAiMode("up");
    await resetE2eBanjar();
  });

  test("scan → register new dog → record vaccine, then the same dog is recognised", async ({ page }) => {
    await login(page);
    await chooseBanjar(page);
    await page.getByRole("link", { name: "Scan anjing" }).click();

    await page.getByTestId("photo-input").setInputFiles(fixture("photo-a.jpg"));
    await expect(page.getByText("Foto bisa dipakai")).toBeVisible();
    await page.getByRole("button", { name: /Cari kecocokan/ }).click();

    await expect(page.getByRole("heading", { name: "Tidak ada yang mirip" })).toBeVisible();
    await page.getByRole("button", { name: "Daftarkan anjing baru" }).click();

    await page.getByLabel("Warna bulu").fill("Cokelat belang putih");
    await page.getByLabel("Nama panggilan").fill("Belang E2E");
    await page.getByText("Liar", { exact: true }).click();
    await page.getByRole("button", { name: "Simpan anjing" }).click();

    await expect(page.getByRole("heading", { name: "Anjing terdaftar" })).toBeVisible();
    await page.getByLabel("Nomor batch vaksin").fill("E2E-001");
    await page.getByRole("button", { name: "Catat vaksin" }).click();
    await expect(page.getByText("Vaksin tercatat")).toBeVisible();

    await page.getByRole("button", { name: "Scan anjing berikutnya" }).click();
    await page.getByTestId("photo-input").setInputFiles(fixture("photo-a.jpg"));
    await expect(page.getByText("Foto bisa dipakai")).toBeVisible();
    await page.getByRole("button", { name: /Cari kecocokan/ }).click();

    await expect(page.getByRole("heading", { name: "Sangat mirip" })).toBeVisible();
    await expect(page.getByText("Belang E2E")).toBeVisible();
    await expect(page.getByText("1,00")).toBeVisible();
    await page.getByRole("button", { name: "Ya, anjing ini" }).click();

    await expect(page.getByRole("heading", { name: "Anjing dikenali" })).toBeVisible();
    await expect(page.getByText(/^Tervaksin/)).toBeVisible();
    await page.getByRole("button", { name: "Selesai, tidak divaksin" }).click();
    await expect(page.getByText("Tersimpan")).toBeVisible();

    await page.getByRole("link", { name: "Lihat data anjing" }).click();
    await expect(page.getByRole("heading", { name: "Belang E2E" })).toBeVisible();
    await expect(page.getByText("Terverifikasi AI", { exact: true })).toBeVisible();
    await expect(page.getByText("Batch E2E-001")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Foto (2)" })).toBeVisible();
  });

  test("protected pages send signed-out visitors to the login page", async ({ page }) => {
    await page.goto("/petugas/scan");
    await expect(page).toHaveURL(/\/masuk\?lanjut=%2Fpetugas%2Fscan/);
  });
});
