#!/usr/bin/env bun
/**
 * Test suite triage tool for @solidports/recharts.
 * Runs vitest with JSON reporter, buckets failures by pattern, emits .triage/ reports.
 * Usage: bun scripts/triage-tests.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const PKG_ROOT = join(import.meta.dir, "..");
const TRIAGE_DIR = join(PKG_ROOT, ".triage");
const VITEST_OUTPUT = "/tmp/vitest-recharts-results.json";

/* Runtime budget: 40 minutes (post hook-contract migration suite is slower) */
const BUDGET_MS = 40 * 60 * 1000;

/* Files that hang the worker — excluded from run. */
const EXCLUDED_FILES: readonly string[] = [];
/* Legacy alias retained for the report header. */
const EXCLUDED_FILE = EXCLUDED_FILES.join(", ");

/* ANSI escape sequence — intentional control char use for stripping color codes */
const ANSI_RE = /\[[0-9;]*m/g;

/* ── bucket definitions ── */

type BucketKey =
  | "reactive-drift"
  | "api-shape"
  | "test-helper"
  | "animation"
  | "measurement"
  | "store-semantics"
  | "test-fixture"
  | "timeout"
  | "unclassified";

interface BucketDef {
  key: BucketKey;
  label: string;
  quickfix: string;
  test: (msg: string, stack: string, file: string) => boolean;
}

const BUCKETS: BucketDef[] = [
  {
    key: "reactive-drift",
    label: "Reactive drift",
    quickfix:
      "Wrap useAppSelector call sites in createMemo. Replace destructured store reads with props.foo / ctx.store.foo direct access.",
    test: (msg, stack) => {
      const both = `${msg} ${stack}`;
      /* stale reads, undefined access on store paths, snapshot-not-accessor shape */
      if (/destructur|reads store directly/i.test(both)) return true;
      if (/useAppSelector|useSelector/i.test(both)) return true;
      if (/cannot read propert(y|ies) of undefined/i.test(msg) && /src\/state\//i.test(stack))
        return true;
      if (/undefined is not iterable/i.test(msg) && /src\/state\//i.test(stack)) return true;
      if (/stale|staleValue/i.test(both) && /state|selector/i.test(both)) return true;
      if (/expected.*called with.*but (got|received)/i.test(msg) && /state/i.test(stack))
        return true;
      /* "computations created outside createRoot" = reactive tracking scope missing */
      if (/computations created outside.*createRoot/i.test(both)) return true;
      /* Object.is equality failures on same-shape objects = Solid store proxy identity mismatch */
      if (/Object\.is equality/i.test(msg)) return true;
      /* expected [] to be [] — same shape but different proxy reference */
      if (/expected \[.*\] to be \[/i.test(msg)) return true;
      /* vi.fn() called N times but expected M — effect fires too many times due to non-fine-grained tracking */
      if (/vi\.fn\(\)"? to be called \d+ times.*got \d+/i.test(msg)) return true;
      /* activeIndex state not resetting — store not updating reactively */
      if (/activeIndex.*isActive.*to deeply equal/i.test(msg)) return true;
      /* empty list when data expected — chart data not flowing into render */
      if (/expected \[\] to deeply equal/i.test(msg)) return true;
      if (/expected .* to have a length of \d+ but got \+0/i.test(msg)) return true;
      return false;
    },
  },
  {
    key: "store-semantics",
    label: "Store semantics",
    quickfix:
      "Collapse StoreAction thunks into createActions factory. Replace dispatch shim with direct setStore calls. Implement getState() on store wrapper.",
    test: (msg, stack) => {
      const both = `${msg} ${stack}`;
      /* getState is not a function = Redux-style store API used against Solid store */
      if (/getState is not a function/i.test(both)) return true;
      /* named slice action exports called as functions but not wired */
      if (/is not a function/i.test(msg) && /addTooltipEntrySettings|setMouseClick|createRechartsStore|StoreAction/i.test(both))
        return true;
      /* TypeError: (callback) => { ... } — thunk passed as callback but expected plain fn */
      if (/TypeError: \(callback\)/i.test(msg)) return true;
      /* toArray / other recharts util not exported from Solid port */
      if (/is not a function/i.test(msg) && /toArray|__vite_ssr_import/i.test(both)) return true;
      return /setStore is not a function|action is not a thunk|StoreAction|useAppDispatch|dispatch.*not.*function/i.test(
        both,
      );
    },
  },
  {
    key: "api-shape",
    label: "API shape mismatch",
    quickfix:
      "Align prop names with Solid JSX (onClick ok, children as JSX.Element not ReactNode[]). Fix IntrinsicAttributes errors.",
    test: (msg) => {
      /* wrong element rendered or wrong attribute value */
      if (/expected <(line|rect|g|circle|path|text|svg)\b/i.test(msg)) return true;
      if (/toHaveAttribute/i.test(msg)) return true;
      if (/Unexpected null/i.test(msg)) return true;
      /* wrong callback args — prop threading issue */
      if (/expected last.*vi\.fn\(\).*called with/i.test(msg)) return true;
      return /prop .* is required|unknown prop|IntrinsicAttributes|not assignable to type|children|Element is not a valid JSX|cannot read properties of undefined.*reading.*(props|render)|ReactNode/i.test(
        msg,
      );
    },
  },
  {
    key: "test-helper",
    label: "Test helper (React idioms in tests)",
    quickfix:
      "Replace rerender(<X />) with signal-based update via renderWithSignals. Remove act() calls. Replace fireEvent React idioms. Fix test-inside-test nesting errors.",
    test: (msg, stack) => {
      const both = `${msg} ${stack}`;
      /* vitest error for tests nested inside other tests — React pattern using describe callbacks */
      if (/test function inside another test function/i.test(both)) return true;
      /* vi.fn() spy implementation warning — React-style spyOn usage */
      if (/vi\.fn\(\).*mock did not use/i.test(both)) return true;
      /* STACK_TRACE_ERROR = vitest collection-phase failure; test threw during describe() callback.
         The whole file's tests are marked failed. Always a structural React→Solid idiom mismatch. */
      if (msg === "Error: STACK_TRACE_ERROR") return true;
      return /rerender is not a function|rerender.*not.*defined|\bact\b.*not.*defined|act is not|flushMicro|waitFor.*timed out|fireEvent.*not.*trigger|unmount is not a function/i.test(
        both,
      );
    },
  },
  {
    key: "animation",
    label: "Animation timing",
    quickfix:
      "Mock requestAnimationFrame deterministically via test/helper/mockRAF.ts. For end-state tests await a timeout.",
    test: (msg, stack, file) => {
      if (/test\/animation\//i.test(file)) return true;
      return /react-smooth|requestAnimationFrame|\brAF\b|animation|transition|duration exceeded|Cannot set properties of null.*stroke/i.test(
        `${msg} ${stack}`,
      );
    },
  },
  {
    key: "measurement",
    label: "jsdom layout / measurement",
    quickfix:
      "Call mockGetBoundingClientRect helper at test top. Ensure ResizeObserver mock is active.",
    test: (msg) => {
      return /getBoundingClientRect|getTotalLength|clientWidth|clientHeight|offsetWidth|offsetHeight|ResizeObserver|layout.*0|getComputedStyle|Cannot set property range.*has only a getter/i.test(
        msg,
      );
    },
  },
  {
    key: "test-fixture",
    label: "Test fixture / data shape",
    quickfix:
      "Export missing test helpers from test/helper/ or fix ReferenceError imports. Update mock data shapes to match Solid port's revised types.",
    test: (msg, stack) => {
      const both = `${msg} ${stack}`;
      if (/cannot find module|fixture/i.test(both)) return true;
      /* ReferenceError on test-local helpers — symbol not exported or wrong import */
      if (/ReferenceError:.*is not defined/i.test(msg)) return true;
      /* data-shape mismatches not caught by reactive-drift or measurement */
      if (/undefined is not iterable/i.test(msg)) return true;
      if (/toEqual|toMatchSnapshot|expect.*received|objectContaining/i.test(both)) return true;
      return false;
    },
  },
  {
    key: "timeout",
    label: "Timeout / worker terminated",
    quickfix:
      "Investigate with --pool=forks --poolOptions.forks.singleFork=true. Likely infinite createEffect loop.",
    test: (msg, stack) => {
      return /timed out|worker.*terminated|worker.*killed|channel closed/i.test(
        `${msg} ${stack}`,
      );
    },
  },
];

/* ── vitest JSON types (subset we use) ── */

interface VitestAssertionResult {
  ancestorTitles: string[];
  failureMessages: string[];
  fullName: string;
  status: "passed" | "failed" | "pending" | "skipped";
  title: string;
}

interface VitestTestResult {
  assertionResults: VitestAssertionResult[];
  /* vitest JSON reporter uses "name" for the file path, not "testFilePath" */
  name: string;
  status: "passed" | "failed";
}

interface VitestJson {
  numFailedTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numTotalTests: number;
  testResults: VitestTestResult[];
}

/* ── bucketing ── */

interface Failure {
  bucket: BucketKey;
  errorMessage: string;
  file: string;
  stackFirst: string;
  testName: string;
}

function classify(f: Omit<Failure, "bucket">): BucketKey {
  for (const bucket of BUCKETS) {
    if (bucket.test(f.errorMessage, f.stackFirst, f.file)) return bucket.key;
  }
  return "unclassified";
}

/* ── date stamp ── */

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/* ── run vitest ── */

function runVitest(): VitestJson | null {
  console.log("Running vitest (JSON reporter)…");
  const start = Date.now();

  const result = spawnSync(
    "bunx",
    [
      "vitest",
      "run",
      "--reporter=json",
      `--outputFile=${VITEST_OUTPUT}`,
      ...EXCLUDED_FILES.map((f) => `--exclude=${f}`),
    ],
    {
      cwd: PKG_ROOT,
      maxBuffer: 64 * 1024 * 1024,
      /* capture stderr so noise doesn't flood terminal */
      stdio: ["ignore", "pipe", "pipe"],
      timeout: BUDGET_MS,
    },
  );

  const elapsedSec = Math.round((Date.now() - start) / 1000);
  console.log(`Vitest finished in ${elapsedSec}s (budget: ${BUDGET_MS / 1000}s)`);

  if (result.error) {
    console.error("Vitest spawn error:", result.error.message);
    return null;
  }

  if (!existsSync(VITEST_OUTPUT)) {
    console.error("No JSON output written — vitest may have crashed.");
    if (result.stderr) console.error(result.stderr.toString().slice(0, 2000));
    return null;
  }

  const raw = readFileSync(VITEST_OUTPUT, "utf8");
  return JSON.parse(raw) as VitestJson;
}

/* ── collect failures ── */

function collectFailures(json: VitestJson): Failure[] {
  const failures: Failure[] = [];

  for (const tr of json.testResults) {
    if (tr.status !== "failed") continue;
    const relFile = relative(PKG_ROOT, tr.name);

    for (const ar of tr.assertionResults) {
      if (ar.status !== "failed") continue;
      const rawMsg = ar.failureMessages[0] ?? "";
      /* first line = message, remaining lines = stack */
      const msgLines = rawMsg.split("\n");
      const errorMessage = msgLines[0]?.replace(ANSI_RE, "").trim() ?? "";
      const stackFirst = msgLines
        .slice(1, 4)
        .map((l) => l.replace(ANSI_RE, "").trim())
        .filter(Boolean)
        .join(" | ");

      const partial = { errorMessage, file: relFile, stackFirst, testName: ar.fullName };
      failures.push({ ...partial, bucket: classify(partial) });
    }
  }

  return failures;
}

/* ── aggregate ── */

interface BucketStats {
  count: number;
  files: Map<string, number>;
  sample: string;
}

function aggregate(failures: Failure[]): Map<BucketKey, BucketStats> {
  const map = new Map<BucketKey, BucketStats>();

  for (const f of failures) {
    if (!map.has(f.bucket)) {
      map.set(f.bucket, { count: 0, files: new Map(), sample: f.errorMessage });
    }
    const stats = map.get(f.bucket);
    if (!stats) continue;
    stats.count++;
    stats.files.set(f.file, (stats.files.get(f.file) ?? 0) + 1);
  }

  return map;
}

/* ── emit .triage/ files ── */

function emitBucketTxt(key: BucketKey, stats: BucketStats, dir: string) {
  const sorted = [...stats.files.entries()].sort((a, b) => b[1] - a[1]);
  const content = `${sorted.map(([file, count]) => `${count}\t${file}`).join("\n")}\n`;
  writeFileSync(join(dir, `bucket-${key}.txt`), content);
}

function emitMarkdownReport(
  failures: Failure[],
  stats: Map<BucketKey, BucketStats>,
  elapsedSec: number,
  ts: string,
  excludedNote: string,
  dir: string,
) {
  const total = failures.length;
  const lines: string[] = [];

  lines.push(`# Triage report — ${ts}`);
  lines.push("");
  lines.push(`**Total failures:** ${total}`);
  lines.push(`**Vitest elapsed:** ${elapsedSec}s`);
  lines.push(`**Excluded (timeout-risk):** ${EXCLUDED_FILE}`);
  if (excludedNote) lines.push(`**Note:** ${excludedNote}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("Bucket               Count   Pct");
  lines.push("─────────────────────────────────────");

  for (const bucket of BUCKETS) {
    const s = stats.get(bucket.key);
    if (!s) continue;
    const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0.0";
    lines.push(`${bucket.key.padEnd(22)} ${String(s.count).padStart(5)}   ${pct}%`);
  }
  const unclass = stats.get("unclassified");
  if (unclass) {
    const pct = total > 0 ? ((unclass.count / total) * 100).toFixed(1) : "0.0";
    lines.push(`${"unclassified".padEnd(22)} ${String(unclass.count).padStart(5)}   ${pct}%`);
  }
  lines.push("");

  const allBuckets: Array<{ key: BucketKey; label: string; quickfix: string }> = [
    ...BUCKETS,
    { key: "unclassified", label: "Unclassified", quickfix: "Manual review required." },
  ];

  for (const bucket of allBuckets) {
    const s = stats.get(bucket.key);
    if (!s) continue;

    lines.push(`## ${bucket.label} (${s.count})`);
    lines.push("");
    lines.push(`**Quickfix hypothesis:** ${bucket.quickfix}`);
    lines.push("");
    lines.push("Top files by failure count:");
    const sorted = [...s.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [file, count] of sorted) {
      lines.push(`  ${count}  ${file}`);
    }
    lines.push("");
    lines.push(`First error: \`${s.sample.slice(0, 120)}\``);
    lines.push("");
  }

  writeFileSync(join(dir, `report-${ts}.md`), lines.join("\n"));
}

function emitJsonReport(
  failures: Failure[],
  stats: Map<BucketKey, BucketStats>,
  elapsedSec: number,
  ts: string,
  dir: string,
) {
  const buckets: Record<string, { count: number; sample: string; topFiles: [string, number][] }> =
    {};

  for (const [key, s] of stats) {
    buckets[key] = {
      count: s.count,
      sample: s.sample,
      topFiles: [...s.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  }

  const out = {
    buckets,
    elapsedSec,
    excludedFile: EXCLUDED_FILE,
    failures: failures.map((f) => ({
      bucket: f.bucket,
      errorMessage: f.errorMessage.slice(0, 200),
      file: f.file,
      testName: f.testName,
    })),
    generatedAt: new Date().toISOString(),
    total: failures.length,
  };

  writeFileSync(join(dir, `report-${ts}.json`), JSON.stringify(out, null, 2));
}

/* ── main ── */

function main() {
  mkdirSync(TRIAGE_DIR, { recursive: true });

  const ts = stamp();
  const runStart = Date.now();

  const json = runVitest();
  const elapsedSec = Math.round((Date.now() - runStart) / 1000);

  if (!json) {
    console.error("Triage aborted: vitest did not produce usable JSON.");
    process.exit(1);
  }

  const failures = collectFailures(json);
  const stats = aggregate(failures);

  /* Verify bucket counts sum to total */
  const bucketSum = [...stats.values()].reduce((acc, s) => acc + s.count, 0);
  if (bucketSum !== failures.length) {
    console.warn(
      `WARN: bucket sum (${bucketSum}) !== total failures (${failures.length}). Investigate classifier.`,
    );
  }

  for (const [key, s] of stats) {
    emitBucketTxt(key, s, TRIAGE_DIR);
  }

  const exceededBudget = elapsedSec > BUDGET_MS / 1000;
  const excludedNote = exceededBudget
    ? `Run EXCEEDED budget (${elapsedSec}s > ${BUDGET_MS / 1000}s). Results may be partial.`
    : "";

  emitMarkdownReport(failures, stats, elapsedSec, ts, excludedNote, TRIAGE_DIR);
  emitJsonReport(failures, stats, elapsedSec, ts, TRIAGE_DIR);

  console.log(`\nTriage complete in ${elapsedSec}s`);
  console.log(`Total failures: ${failures.length}`);
  console.log(`Bucket files:   .triage/bucket-*.txt`);
  console.log(`Report:         .triage/report-${ts}.md`);
  console.log(`JSON:           .triage/report-${ts}.json`);
  console.log("");

  for (const bucket of BUCKETS) {
    const s = stats.get(bucket.key);
    if (!s) continue;
    const pct = failures.length > 0 ? ((s.count / failures.length) * 100).toFixed(1) : "0.0";
    console.log(`  ${bucket.key.padEnd(22)} ${String(s.count).padStart(5)}  ${pct}%`);
  }
  const unclass = stats.get("unclassified");
  if (unclass) {
    const pct =
      failures.length > 0 ? ((unclass.count / failures.length) * 100).toFixed(1) : "0.0";
    console.log(`  ${"unclassified".padEnd(22)} ${String(unclass.count).padStart(5)}  ${pct}%`);
  }

  if (excludedNote) console.warn(`\n${excludedNote}`);
  console.log(`\nEXCLUDED: ${EXCLUDED_FILE} — worker timeout risk. Investigate separately.`);
}

main();
