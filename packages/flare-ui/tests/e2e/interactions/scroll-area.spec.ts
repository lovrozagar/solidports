import { expect, test } from "@playwright/test";

test.describe("ScrollArea", () => {
	test.beforeEach(({ page }) => page.goto("/scroll-area"));

	test("scrollbar visible", async ({ page }) => {
		await expect(page.locator("[data-orientation=vertical]").first()).toBeVisible();
	});

	test("content rendered", async ({ page }) => {
		await expect(page.getByText("Item 1", { exact: true })).toBeVisible();
		await expect(page.getByText("Items")).toBeVisible();
	});
});
