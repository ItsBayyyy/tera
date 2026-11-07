import { expect, test } from "@playwright/test";
import { setAiMode } from "./helpers";

test("demo page works without login and labels its data", async ({ page }) => {
  await setAiMode("up");
  await page.goto("/");
  await page.getByRole("link", { name: "Mode demo untuk juri" }).click();
  await expect(page.getByRole("heading", { name: "Mode demo" })).toBeVisible();
  await expect(page.getByText("Data demo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anjing terdaftar di banjar DEMO" })).toBeVisible();
});
