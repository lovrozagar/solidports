import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const names = (page: Page) => page.locator("tbody tr td[data-column=name]").allTextContents();
const clean = (texts: Array<string>) => texts.map((t) => t.replace(/^[+-]/, ""));

test.beforeEach(async ({ page }) => {
	await page.goto("/?demo=grid");
	await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("renders the first page", async ({ page }) => {
	expect(clean(await names(page))).toEqual(["Ada", "Grace", "Linus", "Margaret"]);
	await expect(page.getByLabel("Page")).toHaveText("1/2");
});

test("header clicks cycle sorting", async ({ page }) => {
	const name = page.locator("th[data-column=name]");
	await name.getByText("Name").click();
	await expect(name).toHaveAttribute("aria-sort", "ascending");
	expect(clean(await names(page))).toEqual(["Ada", "Barbara", "Grace", "Ken"]);
	await name.getByText("Name").click();
	await expect(name).toHaveAttribute("aria-sort", "descending");
	expect(clean(await names(page))).toEqual(["Margaret", "Linus", "Ken", "Grace"]);
});

test("sorting resets to the first page", async ({ page }) => {
	await page.getByRole("button", { name: "Next" }).click();
	await expect(page.getByLabel("Page")).toHaveText("2/2");
	await page.locator("th[data-column=age]").getByText("Age").click();
	await expect(page.getByLabel("Page")).toHaveText("1/2");
});

test("pagination moves between pages", async ({ page }) => {
	await page.getByRole("button", { name: "Next" }).click();
	expect(clean(await names(page))).toEqual(["Ken", "Barbara"]);
	await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
	await page.getByRole("button", { name: "Previous" }).click();
	await expect(page.getByLabel("Page")).toHaveText("1/2");
});

test("controlled selection: single rows and select all", async ({ page }) => {
	await page.getByLabel("Select Grace").check();
	await expect(page.getByLabel("Selection")).toHaveText("2");
	await page.getByLabel("Select all").check();
	await expect(page.getByLabel("Selection")).toHaveText("1,1.1,1.2,2,3,4,5,6");
	await expect(page.getByLabel("Select Linus")).toBeChecked();
	await page.getByLabel("Select all").uncheck();
	await expect(page.getByLabel("Selection")).toHaveText("");
});

test("global and column filters", async ({ page }) => {
	await page.getByLabel("Global filter").fill("ar");
	await expect(page.locator("tbody tr")).toHaveCount(2);
	expect(clean(await names(page))).toEqual(["Margaret", "Barbara"]);
	await page.getByLabel("Global filter").fill("");
	await page.getByLabel("Team filter").fill("compiler");
	expect(clean(await names(page))).toEqual(["Grace", "Ken"]);
});

test("expanding sub-rows", async ({ page }) => {
	await page.getByLabel("Expand Ada").click();
	await expect(page.locator("tbody tr")).toHaveCount(4);
	expect(clean(await names(page))).toEqual(["Ada", "Bob", "Cy", "Grace"]);
	await page.getByLabel("Expand Ada").click();
	expect(clean(await names(page))).toEqual(["Ada", "Grace", "Linus", "Margaret"]);
});

test("grouping aggregates and expands groups", async ({ page }) => {
	await page.getByRole("button", { name: "Group by team" }).click();
	await expect(page.locator("tbody tr")).toHaveCount(3);
	await expect(page.locator("tbody td[data-column=team]")).toHaveText(["core (2)", "compiler (2)", "apollo (2)"]);
	await expect(page.locator("tbody td[data-column=age]")).toHaveText(["max 54", "max 85", "max 41"]);
	await page.getByLabel("Toggle group compiler").click();
	await expect(page.locator("tbody tr")).toHaveCount(4);
	await expect(page.locator("tbody td[data-column=age]")).toHaveText(["max 54", "max 85", "85", "80"]);
});

test("column visibility toggles", async ({ page }) => {
	await page.getByLabel("Show team").uncheck();
	await expect(page.locator("th[data-column=team]")).toHaveCount(0);
	await expect(page.locator("td[data-column=team]")).toHaveCount(0);
	await page.getByLabel("Show team").check();
	await expect(page.locator("th[data-column=team]")).toHaveCount(1);
});

test("column pinning moves the column first", async ({ page }) => {
	await page.getByRole("button", { name: "Pin age" }).click();
	await expect(page.locator("thead th").first()).toHaveAttribute("data-column", "age");
	expect(await page.locator("thead th").evaluateAll((ths) => ths.map((th) => th.getAttribute("data-column")))).toEqual([
		"age",
		"select",
		"name",
		"team",
	]);
	expect(
		await page
			.locator("tbody tr")
			.first()
			.locator("td")
			.evaluateAll((tds) => tds.map((td) => td.getAttribute("data-column"))),
	).toEqual(["age", "select", "name", "team"]);
});

test("drag resizing updates column width live", async ({ page }) => {
	const th = page.locator("th[data-column=name]");
	const before = (await th.boundingBox())!.width;
	const handle = (await page.locator("[data-resizer=name]").boundingBox())!;
	await page.mouse.move(handle.x + 2, handle.y + 5);
	await page.mouse.down();
	await page.mouse.move(handle.x + 52, handle.y + 5, { steps: 5 });
	await expect.poll(async () => Math.round((await th.boundingBox())!.width)).toBe(Math.round(before + 50));
	await page.mouse.up();
	await expect.poll(async () => Math.round((await th.boundingBox())!.width)).toBe(Math.round(before + 50));
});

test("reset restores the initial state", async ({ page }) => {
	await page.locator("th[data-column=age]").getByText("Age").click();
	await page.getByLabel("Show team").uncheck();
	await page.getByRole("button", { name: "Reset" }).click();
	await expect(page.locator("th[data-column=age]")).toHaveAttribute("aria-sort", "none");
	await expect(page.locator("th[data-column=team]")).toHaveCount(1);
	expect(clean(await names(page))).toEqual(["Ada", "Grace", "Linus", "Margaret"]);
});
