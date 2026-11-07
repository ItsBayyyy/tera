import { expect, test } from "@playwright/test";
import { chooseBanjar, fixture, login, resetE2eBanjar, setAiMode } from "./helpers";

test.describe("officer flow with the AI service down", () => {
  test.beforeAll(async () => {
    await resetE2eBanjar();
  });

  test.afterAll(async () => {
    await setAiMode("up");
  });

  test("records without AI verification, then the rematch job verifies it once AI is back", async ({ page }) => {
    await setAiMode("down");
    await login(page);
    await chooseBanjar(page);
    await page.getByRole("link", { name: "Scan anjing" }).click();

    await page.getByTestId("photo-input").setInputFiles(fixture("photo-b.jpg"));
    await expect(page.getByText("AI sedang tidak tersedia.")).toBeVisible();
    await page.getByRole("button", { name: "Catat tanpa verifikasi AI" }).click();

    await expect(page.getByRole("heading", { name: "Daftarkan anjing baru" })).toBeVisible();
    await page.getByLabel("Warna bulu").fill("Hitam");
    await page.getByRole("button", { name: "Simpan anjing" }).click();
    await page.getByRole("button", { name: "Catat vaksin" }).click();
    await expect(page.getByText("menunggu verifikasi AI")).toBeVisible();

    await page.getByRole("link", { name: "Lihat data anjing" }).click();
    await expect(page.getByText("Menunggu verifikasi AI", { exact: true })).toBeVisible();
    await expect(page.getByText("Belum dicocokkan")).toBeVisible();
    const dogUrl = page.url();

    await setAiMode("up");
    const response = await page.request.post("/api/jobs/rematch", {
      headers: { Authorization: "Bearer e2e-jobs-secret" },
    });
    expect(response.ok()).toBe(true);
    const summary = await response.json();
    expect(summary.aiAvailable).toBe(true);
    expect(summary.embedded).toBeGreaterThanOrEqual(1);

    await page.goto(dogUrl);
    await expect(page.getByText("Terverifikasi AI", { exact: true })).toBeVisible();
    await expect(page.getByText("Belum dicocokkan")).toHaveCount(0);
  });

  test("the rematch job refuses callers without the job secret or an admin session", async ({ request }) => {
    const response = await request.post("/api/jobs/rematch");
    expect(response.status()).toBe(401);
  });
});
