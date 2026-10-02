import { test as base, expect } from "@playwright/test";

/* Any console warning or error (Solid dev diagnostics included) or uncaught page error fails the test.
   HOT_SCOPE_TIME is a dev-only perf budget notice; sorting 10k rows legitimately exceeds it. */
const ALLOWED = ["[HOT_SCOPE_TIME]"];
export const test = base.extend<{ consoleProblems: Array<string> }>({
	consoleProblems: [
		async ({ page }, use) => {
			const problems: Array<string> = [];
			page.on("console", (msg) => {
				if (
					(msg.type() === "warning" || msg.type() === "error") &&
					!ALLOWED.some((code) => msg.text().startsWith(code))
				)
					problems.push(`${msg.type()}: ${msg.text()}`);
			});
			page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
			await use(problems);
			expect(problems).toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };
