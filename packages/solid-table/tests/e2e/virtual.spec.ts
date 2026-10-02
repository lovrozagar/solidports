import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
	await page.goto("/?demo=virtual");
	await expect(page.getByLabel("Total rows")).toHaveText("10000");
});

test("renders only the visible window of 10k rows", async ({ page }) => {
	const count = await page.locator("[data-row]").count();
	expect(count).toBeGreaterThan(5);
	expect(count).toBeLessThan(40);
	await expect(page.locator("[data-row]").first()).toHaveAttribute("data-row", "0");
});

test("scrolling swaps in later rows", async ({ page }) => {
	await page.getByTestId("scroller").evaluate((el) => (el.scrollTop = 30 * 5000));
	await expect(page.locator("[data-row='5000']")).toBeVisible();
	expect(await page.locator("[data-row]").count()).toBeLessThan(40);
});

test("sorting reorders the virtualized rows", async ({ page }) => {
	await page.getByRole("button", { name: "Sort by age" }).click();
	await expect(page.locator("[data-row]").first().locator("span").nth(1)).toHaveText("20");
});
