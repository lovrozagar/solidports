import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
	await page.goto("/?demo=hook");
	await expect(page.locator("tbody tr")).toHaveCount(6);
});

test("header and footer templates both render on a leaf column", async ({ page }) => {
	await expect(page.locator("thead th")).toHaveText(["Name", "Age"]);
	await expect(page.locator("tfoot td")).toHaveText(["names", "rows 6"]);
	await expect(page.getByLabel("Row count")).toHaveText("6");
});

test("bound header components react to controlled sorting", async ({ page }) => {
	await page.locator("th[data-column=age]").click();
	await expect(page.getByLabel("Sorting")).toHaveText('[{"id":"age","desc":true}]');
	await expect(page.locator("th[data-column=age] [data-sort-indicator]")).toHaveText("▼");
	await expect(page.locator("tbody tr").first()).toHaveAttribute("data-row", "2");
});

test("bound cell components react to row state", async ({ page }) => {
	const row = page.locator("tbody tr[data-row='3']");
	await row.click();
	await expect(row.locator("[data-selected=true]")).toHaveCount(2);
	await row.click();
	await expect(row.locator("[data-selected=true]")).toHaveCount(0);
});
