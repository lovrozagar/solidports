#!/usr/bin/env bun
/*
 * release-target <tag>: the package a release tag publishes, as GitHub Actions outputs
 * (`name=`, `dir=`, `id=`, `version=`, `dist_tag=`). The tag is `<prefix><version>` from
 * scripts/packages.ts and must match that package's package.json version. Prereleases
 * (`1.8.0-9`) go to the `next` dist-tag, the rest to `latest`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publishedPackages } from "./packages.ts";

export interface ReleaseTarget {
	dir: string;
	distTag: "latest" | "next";
	id: string;
	name: string;
	version: string;
}

export function releaseTarget(ref: string, readVersion: (dir: string) => string): ReleaseTarget {
	const tag = ref.replace(/^refs\/tags\//, "");
	const pkg = publishedPackages.find((candidate) => tag.startsWith(candidate.tag));
	if (!pkg) {
		const prefixes = publishedPackages.map((candidate) => `${candidate.tag}<version>`).join(", ");
		throw new Error(`tag ${tag} names no published package (expected ${prefixes})`);
	}
	const version = tag.slice(pkg.tag.length);
	if (!version) throw new Error(`tag ${tag} has no version`);
	const current = readVersion(pkg.dir);
	if (version !== current) {
		throw new Error(`tag ${tag} does not match ${pkg.dir}/package.json version ${current}`);
	}
	return { dir: pkg.dir, distTag: version.includes("-") ? "next" : "latest", id: pkg.id, name: pkg.name, version };
}

if (import.meta.main) {
	const ref = process.argv[2];
	if (!ref) {
		console.error("usage: release-target <tag>");
		process.exit(1);
	}
	const root = join(import.meta.dir, "..");
	const readVersion = (dir: string) =>
		(JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")) as { version: string }).version;
	try {
		const target = releaseTarget(ref, readVersion);
		console.log(
			[
				`name=${target.name}`,
				`dir=${target.dir}`,
				`id=${target.id}`,
				`version=${target.version}`,
				`dist_tag=${target.distTag}`,
			].join("\n"),
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
