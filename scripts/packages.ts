/**
 * Published workspace packages. A release is the tag `<tag><version>` (e.g. `solid-table-v0.1.1`);
 * `.github/workflows/release.yml` publishes the package the prefix names.
 */
export const publishedPackages = [
	{ dir: "packages/base-ui/packages/solid", id: "base-ui", name: "@solidports/base-ui", tag: "base-ui-v" },
	{ dir: "packages/recharts", id: "recharts", name: "@solidports/recharts", tag: "recharts-v" },
	{ dir: "packages/solid-table", id: "solid-table", name: "@solidports/solid-table", tag: "solid-table-v" },
] as const;

export type PublishedPackage = (typeof publishedPackages)[number];
