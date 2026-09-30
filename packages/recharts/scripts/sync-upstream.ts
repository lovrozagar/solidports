#!/usr/bin/env bun
/**
 * Upstream sync tool for @solidports/recharts.
 * Subcommands: fetch | status | diff [from-sha] [to-sha] | apply <sha> | pin <tag-or-sha>
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* Resolve package root regardless of cwd */
const PKG_ROOT = join(import.meta.dir, "..");
const UPSTREAM_DIR = join(PKG_ROOT, ".upstream");
const CACHE_DIR = join(UPSTREAM_DIR, "cache");
const PATCHES_DIR = join(UPSTREAM_DIR, "patches");
const PINNED_FILE = join(UPSTREAM_DIR, "pinned.json");
const APPLIED_FILE = join(UPSTREAM_DIR, "applied.jsonl");
const MAP_FILE = join(UPSTREAM_DIR, "map.json");

/* Cache reuse window — 1 hour in ms */
const CACHE_TTL_MS = 60 * 60 * 1000;

/* GitHub API base */
const GH_API = "https://api.github.com";

interface PinnedJson {
  pinned_at: string;
  repo: string;
  sha: string;
  tag: string;
}

interface MapOverride {
  mode: "one-to-one" | "rename" | "split" | "merge" | "heavy-rewrite" | "excluded";
  notes?: string;
  target: string[];
}

interface UpstreamMap {
  defaultMode: string;
  excluded: string[];
  overrides: Record<string, MapOverride>;
  solid_additions: Record<string, { notes: string }>;
  unported_upstream: Record<string, { notes: string }>;
  upstream_sha_pinned: string;
  version: number;
}

interface AppliedEntry {
  files: string[];
  ported_at: string;
  ported_by: string;
  sha: string;
  summary: string;
}

/* ── helpers ── */

function readPinned(): PinnedJson {
  if (!existsSync(PINNED_FILE)) {
    die(".upstream/pinned.json not found — run `bun run upstream:fetch` first");
  }
  return JSON.parse(readFileSync(PINNED_FILE, "utf8")) as PinnedJson;
}

function readMap(): UpstreamMap {
  if (!existsSync(MAP_FILE)) {
    die(".upstream/map.json not found");
  }
  return JSON.parse(readFileSync(MAP_FILE, "utf8")) as UpstreamMap;
}

function die(msg: string): never {
  console.error(`\nerror: ${msg}\n`);
  process.exit(1);
}

function sh(cmd: string, opts: { cwd?: string } = {}): string {
  try {
    return execSync(cmd, {
      cwd: opts.cwd ?? PKG_ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { stderr?: Buffer; stdout?: Buffer };
    const stderr = e.stderr?.toString().trim() ?? "";
    const stdout = e.stdout?.toString().trim() ?? "";
    die(`command failed: ${cmd}\n${stderr || stdout}`);
  }
}

function shOk(cmd: string, opts: { cwd?: string } = {}): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, {
      cwd: opts.cwd ?? PKG_ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024, /* 32MB — GitHub compare API can return >1MB */
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch (err) {
    const e = err as { stdout?: Buffer };
    return { ok: false, out: e.stdout?.toString().trim() ?? "" };
  }
}

function ghApi(path: string): unknown {
  const token = process.env["GITHUB_TOKEN"] ?? "";
  const auth = token ? `-H "Authorization: Bearer ${token}"` : "";
  const { ok, out } = shOk(`curl -sL ${auth} "${GH_API}/${path}"`);
  if (!ok || !out) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function isExcluded(filePath: string, excluded: string[]): boolean {
  return excluded.some((pattern) => {
    /* Convert glob-like patterns to simple prefix/suffix checks */
    if (pattern.endsWith("/**")) {
      return filePath.startsWith(pattern.slice(0, -3));
    }
    if (pattern.includes("*")) {
      const parts = pattern.split("*");
      const first = parts[0] ?? "";
      const last = parts[parts.length - 1] ?? "";
      return filePath.startsWith(first) && filePath.endsWith(last);
    }
    return filePath === pattern;
  });
}

function mapUpstreamFile(filePath: string, map: UpstreamMap): string[] | null {
  if (isExcluded(filePath, map.excluded)) return null;
  const override = map.overrides[filePath];
  if (override) {
    if (override.mode === "excluded") return null;
    return override.target;
  }
  /* Default one-to-one — same path in port */
  return [filePath];
}

function cloneDir(tag: string): string {
  return join(CACHE_DIR, `recharts-${tag}`);
}

function cacheIsFresh(dir: string): boolean {
  if (!existsSync(dir)) return false;
  /* git clone --depth writes FETCH_HEAD after initial clone */
  const headFile = join(dir, ".git", "HEAD");
  if (!existsSync(headFile)) return false;
  const mtime = statSync(headFile).mtimeMs;
  return Date.now() - mtime < CACHE_TTL_MS;
}

function ensureDirs(): void {
  for (const d of [CACHE_DIR, PATCHES_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

/* ── subcommands ── */

function cmdFetch(): void {
  ensureDirs();
  const pinned = readPinned();
  const dir = cloneDir(pinned.tag);

  if (cacheIsFresh(dir)) {
    const head = sh("git rev-parse HEAD", { cwd: dir });
    console.log(`cache fresh (< 1h old) — reusing ${dir}`);
    console.log(`HEAD: ${head}`);
    return;
  }

  if (existsSync(dir)) {
    console.log(`cache exists but stale — re-fetching ${pinned.tag}...`);
    sh(`rm -rf "${dir}"`);
  }

  console.log(`cloning recharts ${pinned.tag} into ${dir}...`);
  sh(
    `git clone --depth=200 --branch=${pinned.tag} https://github.com/${pinned.repo} "${dir}"`,
  );

  const head = sh("git rev-parse HEAD", { cwd: dir });
  console.log(`done. HEAD: ${head}`);

  if (head !== pinned.sha) {
    console.warn(
      `\nwarn: cloned HEAD (${head}) differs from pinned SHA (${pinned.sha}).\n` +
        `      The tag may have been moved. Run \`bun run upstream:pin ${head}\` to re-pin.`,
    );
  }
}

function cmdStatus(): void {
  const pinned = readPinned();
  const map = readMap();

  console.log(`pinned:  ${pinned.tag}  ${pinned.sha}  (pinned ${pinned.pinned_at})`);

  /* Fetch latest main HEAD via GitHub API */
  const data = ghApi(`repos/${pinned.repo}/commits?sha=main&per_page=1`) as
    | Array<{ sha: string }>
    | null;

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn(
      "warn: could not reach GitHub API — rate limited or offline. Showing local cache info only.",
    );
    const dir = cloneDir(pinned.tag);
    if (existsSync(dir)) {
      const head = sh("git rev-parse HEAD", { cwd: dir });
      console.log(`local cache HEAD: ${head}`);
    }
    process.exit(0);
  }

  const latestSha = data[0]?.sha ?? "";
  console.log(`upstream main: ${latestSha}`);

  if (latestSha === pinned.sha) {
    console.log(`\nup-to-date with ${pinned.tag} baseline. 0 actionable code commits unported.`);
    process.exit(0);
  }

  /* Count commits between pin and main using GitHub compare API */
  const compare = ghApi(`repos/${pinned.repo}/compare/${pinned.sha}...${latestSha}`) as {
    ahead_by?: number;
    commits?: Array<{ commit: { message: string }; sha: string }>;
  } | null;

  const ahead = compare?.ahead_by ?? null;
  const commits = compare?.commits ?? [];

  if (ahead === null) {
    console.log(`\ncould not determine commit delta (API compare failed)`);
    process.exit(1);
  }

  console.log(`\n${ahead} commit(s) behind upstream main\n`);

  type CommitEntry = { files: string[]; msg: string; sha: string };
  /* Actionable groups listed first intentionally — display order, not alpha */
  const groups: Record<string, CommitEntry[]> = {
    "ci-only": [],
    code: [],
    "deps-only": [],
    "docs-only": [],
    other: [],
    tests: [],
  };

  for (const c of commits) {
    const msg = c.commit.message.split("\n")[0] ?? "";
    const sha = c.sha.slice(0, 10);

    /* Fetch changed files for each commit via API */
    const detail = ghApi(`repos/${pinned.repo}/commits/${c.sha}`) as {
      files?: Array<{ filename: string }>;
    } | null;
    const files = (detail?.files ?? []).map((f) => f.filename);

    const mappedFiles = files
      .map((f) => mapUpstreamFile(f, map))
      .filter((x): x is string[] => x !== null)
      .flat();

    const hasCode = mappedFiles.some((f) => f.startsWith("src/") && !f.startsWith("src/test"));
    const hasTests = mappedFiles.some((f) => f.startsWith("test/"));
    const allDocs = files.every((f) => /\.(md|mdx|txt)$/.test(f) || f.startsWith("docs/"));
    const allDeps = files.every((f) =>
      /package\.json|bun\.lock|yarn\.lock|pnpm-lock/.test(f),
    );
    const allCI = files.every((f) => /^\.github\/|^\.circleci\//.test(f));

    let group: string;
    if (hasCode) group = "code";
    else if (hasTests) group = "tests";
    else if (allDocs) group = "docs-only";
    else if (allDeps) group = "deps-only";
    else if (allCI) group = "ci-only";
    else group = "other";

    groups[group]?.push({ files: mappedFiles, msg, sha });
  }

  /* Print actionable groups first */
  for (const g of ["code", "tests", "docs-only", "deps-only", "ci-only", "other"]) {
    const items = groups[g] ?? [];
    if (items.length === 0) continue;
    const actionable = g === "code" || g === "tests";
    const label = actionable ? `[actionable] ${g}` : `[info] ${g}`;
    console.log(`${label}: ${items.length} commit(s)`);
    for (const item of items.slice(0, 5)) {
      console.log(`  ${item.sha}  ${item.msg}`);
    }
    if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
    console.log();
  }

  const actionableCount = (groups["code"]?.length ?? 0) + (groups["tests"]?.length ?? 0);
  if (actionableCount > 0) {
    console.log(
      `${actionableCount} actionable commit(s) unported. Run \`bun run upstream:diff\` to inspect.`,
    );
    process.exit(1);
  }

  console.log(`0 actionable code commits unported.`);
  process.exit(0);
}

async function cmdDiff(fromSha?: string, toSha?: string): Promise<void> {
  ensureDirs();
  const pinned = readPinned();
  const dir = cloneDir(pinned.tag);

  if (!existsSync(dir)) {
    die(`upstream cache not found at ${dir} — run \`bun run upstream:fetch\` first`);
  }

  const from = fromSha ?? pinned.sha;
  const to = toSha ?? sh("git rev-parse HEAD", { cwd: dir });

  if (from === to) {
    console.log("no diff — from and to are the same SHA");
    return;
  }

  console.log(`diff ${from.slice(0, 10)}..${to.slice(0, 10)}\n`);

  const rawDiff = sh(`git diff ${from}..${to} -- src/ test/`, { cwd: dir });
  const patchPath = join(UPSTREAM_DIR, "last-diff.patch");
  await Bun.write(patchPath, rawDiff);

  const diffStat = sh(`git diff --stat ${from}..${to} -- src/ test/`, { cwd: dir });
  console.log(diffStat);
  console.log(`\npatch saved to .upstream/last-diff.patch`);
}

function cmdApply(sha: string): void {
  ensureDirs();
  const pinned = readPinned();
  const map = readMap();
  const dir = cloneDir(pinned.tag);

  if (!existsSync(dir)) {
    die(`upstream cache not found — run \`bun run upstream:fetch\` first`);
  }

  const patch = sh(`git show --patch ${sha}`, { cwd: dir });
  const patchPath = join(PATCHES_DIR, `${sha}.patch`);
  /* fire-and-forget write — human reviews output, not return value */
  void Bun.write(patchPath, patch);

  const changedRaw = sh(`git show --name-only --format="" ${sha}`, { cwd: dir });
  const upstreamFiles = changedRaw.split("\n").filter(Boolean);

  console.log(`upstream commit ${sha.slice(0, 10)}`);
  console.log(`\nfiles touched:\n`);

  const heavyRewrites: string[] = [];
  for (const f of upstreamFiles) {
    const solidPaths = mapUpstreamFile(f, map);
    if (solidPaths === null) {
      console.log(`  [excluded]  ${f}`);
    } else {
      const override = map.overrides[f];
      const mode = override?.mode ?? "one-to-one";
      const note = override?.notes ? `  /* ${override.notes} */` : "";
      for (const sp of solidPaths) {
        const portFileExists = existsSync(join(PKG_ROOT, sp));
        const status = portFileExists ? "" : " [MISSING in port]";
        console.log(`  [${mode}]  ${f} → ${sp}${status}${note}`);
        if (mode === "heavy-rewrite") {
          heavyRewrites.push(sp);
        }
      }
    }
  }

  if (heavyRewrites.length > 0) {
    console.log(
      `\nwarn: ${heavyRewrites.length} file(s) marked heavy-rewrite — patch will not apply cleanly. Manual diff required.`,
    );
  }

  console.log(`\npatch written to .upstream/patches/${sha}.patch`);
  console.log(`\nworkflow:`);
  console.log(`  1. Review patch: cat .upstream/patches/${sha}.patch`);
  console.log(`  2. Translate changes to Solid equivalents in the mapped files above`);
  console.log(`  3. Run tests: bunx vitest run`);
  console.log(`  4. Append to applied.jsonl manually or run: bun scripts/sync-upstream.ts pin ${sha}`);
}

async function cmdPin(tagOrSha: string): Promise<void> {
  /* Detect whether it's a tag (starts with v) or bare SHA */
  const isTag = tagOrSha.startsWith("v");
  const pinned = readPinned();

  let sha: string;
  let tag: string;

  if (isTag) {
    tag = tagOrSha;
    const ref = ghApi(`repos/${pinned.repo}/git/refs/tags/${tag}`) as {
      object?: { sha: string; type: string };
    } | null;
    if (!ref?.object) die(`could not resolve tag ${tag} via GitHub API`);

    /* Annotated tags point to tag objects; lightweight tags point directly to commits */
    if (ref.object.type === "tag") {
      const tagObj = ghApi(`repos/${pinned.repo}/git/tags/${ref.object.sha}`) as {
        object?: { sha: string };
      } | null;
      sha = tagObj?.object?.sha ?? ref.object.sha;
    } else {
      sha = ref.object.sha;
    }
  } else {
    sha = tagOrSha;
    tag = pinned.tag;
  }

  const today = new Date().toISOString().slice(0, 10);
  const newPinned: PinnedJson = { pinned_at: today, repo: pinned.repo, sha, tag };
  await Bun.write(PINNED_FILE, `${JSON.stringify(newPinned, null, 2)}\n`);

  const entry: AppliedEntry = {
    files: [],
    ported_at: today,
    ported_by: process.env["USER"] ?? "unknown",
    sha,
    summary: `pinned to ${isTag ? tag : sha.slice(0, 10)}`,
  };

  const existing = existsSync(APPLIED_FILE) ? readFileSync(APPLIED_FILE, "utf8") : "";
  await Bun.write(APPLIED_FILE, `${existing}${JSON.stringify(entry)}\n`);

  console.log(`pinned to ${tag}  ${sha}`);
  console.log(`appended entry to .upstream/applied.jsonl`);
}

function printHelp(): void {
  console.log(`
@solidports/recharts upstream sync tool

usage: bun scripts/sync-upstream.ts <subcommand> [args]

subcommands:
  fetch                     clone upstream recharts at pinned tag (cached 1h)
  status                    compare pin to upstream main; list unported commits
  diff [from-sha] [to-sha]  show diff between two SHAs; saves .upstream/last-diff.patch
  apply <sha>               show patch + Solid counterparts for a single upstream commit
  pin <tag|sha>             advance pinned.json and append entry to applied.jsonl

environment:
  GITHUB_TOKEN              optional — raises API rate limit from 60 to 5000 req/hr

examples:
  bun scripts/sync-upstream.ts fetch
  bun scripts/sync-upstream.ts status
  bun scripts/sync-upstream.ts diff
  bun scripts/sync-upstream.ts diff abc1234 def5678
  bun scripts/sync-upstream.ts apply abc1234def5678abc1234def5678abc1234def56
  bun scripts/sync-upstream.ts pin v3.9.0
`);
}

/* ── entrypoint ── */

async function main(): Promise<void> {
  const [, , subcmd, ...rest] = process.argv;

  switch (subcmd) {
    case "fetch":
      cmdFetch();
      break;
    case "status":
      cmdStatus();
      break;
    case "diff":
      await cmdDiff(rest[0], rest[1]);
      break;
    case "apply": {
      const sha = rest[0];
      if (!sha) die("apply requires a SHA argument");
      cmdApply(sha);
      break;
    }
    case "pin": {
      const tagOrSha = rest[0];
      if (!tagOrSha) die("pin requires a tag or SHA argument");
      await cmdPin(tagOrSha);
      break;
    }
    default:
      printHelp();
      if (subcmd) process.exit(1);
  }
}

await main();
