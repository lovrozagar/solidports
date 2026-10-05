import { describe, expect, test } from "bun:test";
import { releaseTarget } from "./release-target.ts";

const versions: Record<string, string> = {
	"packages/base-ui/packages/solid": "1.8.0-9",
	"packages/recharts": "0.1.2",
	"packages/solid-table": "0.1.1",
};
const readVersion = (dir: string) => versions[dir] ?? "0.0.0";

describe("releaseTarget", () => {
	test("a tag names the package by its prefix", () => {
		expect(releaseTarget("solid-table-v0.1.1", readVersion)).toEqual({
			dir: "packages/solid-table",
			distTag: "latest",
			id: "solid-table",
			name: "@solidports/solid-table",
			version: "0.1.1",
		});
		expect(releaseTarget("recharts-v0.1.2", readVersion).name).toBe("@solidports/recharts");
	});

	test("a prerelease publishes to next, not latest", () => {
		expect(releaseTarget("base-ui-v1.8.0-9", readVersion)).toMatchObject({
			distTag: "next",
			id: "base-ui",
			version: "1.8.0-9",
		});
	});

	test("accepts a full ref", () => {
		expect(releaseTarget("refs/tags/solid-table-v0.1.1", readVersion).version).toBe("0.1.1");
	});

	test("rejects a tag whose version is not the package.json version", () => {
		expect(() => releaseTarget("solid-table-v0.1.2", readVersion)).toThrow(
			"solid-table-v0.1.2 does not match packages/solid-table/package.json version 0.1.1",
		);
	});

	test("rejects a tag that names no published package", () => {
		expect(() => releaseTarget("v0.1.1", readVersion)).toThrow("names no published package");
		expect(() => releaseTarget("solid-table-0.1.1", readVersion)).toThrow("names no published package");
	});

	test("rejects a prefix with no version", () => {
		expect(() => releaseTarget("recharts-v", readVersion)).toThrow("has no version");
	});
});
