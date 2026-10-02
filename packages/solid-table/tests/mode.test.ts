import { expect, test } from "vitest";
import { DEV } from "solid-js";

test("runs against the Solid build selected by NODE_ENV", () => {
	expect(Boolean(DEV)).toBe(process.env.NODE_ENV !== "production");
});
