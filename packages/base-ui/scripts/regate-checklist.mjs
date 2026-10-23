// The regate checklist, generated from bench:component reports (D28): every regression no hand or
// generated allowance holds, the exit-bar targets apart from them, and every row a previous
// checklist listed that no report has shown fixed or allowed since. navigation-menu/8x100 mount
// flagged in regate6, was never routed, and flagged again in regate8: a written checklist dropped it.
//
// Usage (from packages/base-ui): node scripts/regate-checklist.mjs <report.json>... [--previous <checklist.json>]
// writes <first report>-checklist.{json,md}.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const id = (row) => `${row.key} ${row.metric}`;

/**
 * @param {readonly { verdicts: { browser: any[], ssr: any[] }, regressions: { failing: any[], allowed: any[], generated: any[] }, exitBar: { key: string, metric: string, pass: boolean }[] }[]} reports
 *   one regate's reports (its chunks)
 * @param {readonly { key: string, metric: string }[]} previous the last checklist's rows
 */
export function regateChecklist(reports, previous) {
  const rows = new Map();
  const targets = new Map();
  const measured = new Map();
  const allowed = new Set();
  for (const report of reports) {
    for (const v of [...report.verdicts.browser, ...report.verdicts.ssr]) {
      measured.set(id(v), v.verdict);
    }
    for (const v of [...report.regressions.allowed, ...report.regressions.generated]) {
      allowed.add(id(v));
    }
    for (const v of report.regressions.failing) {
      rows.set(id(v), { key: v.key, metric: v.metric, status: 'regressed' });
    }
    for (const t of report.exitBar) {
      if (!t.pass) {
        targets.set(id(t), { key: t.key, metric: t.metric });
      }
    }
  }
  for (const p of previous) {
    const key = id(p);
    if (rows.has(key) || allowed.has(key)) {
      continue;
    }
    const verdict = measured.get(key);
    // Fixed once a report measured it and it no longer regressed; unmeasured rows carry.
    if (verdict !== undefined && verdict !== 'regressed') {
      continue;
    }
    rows.set(key, { key: p.key, metric: p.metric, status: 'carried' });
  }
  return { rows: [...rows.values()], targets: [...targets.values()] };
}

/** The checklist as markdown, one routing line per row. */
export function checklistMarkdown(list) {
  return [
    '# Regate checklist (generated, D28)',
    '',
    'Route each row: a fix with a mechanism, a D24 trade (generated or reviewed), or a D25 residual.',
    '',
    ...list.rows.map((r) => `- [ ] ${r.key} ${r.metric} (${r.status})`),
    '',
    '## Exit-bar targets (not regressions)',
    '',
    ...list.targets.map((t) => `- ${t.key} ${t.metric}`),
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--previous');
  const previousFile = at === -1 ? undefined : args[at + 1];
  // Without `--previous` (`at` is -1), every argument is a report: `at + 1` would drop the first.
  const files = at === -1 ? args : args.filter((_, i) => i !== at && i !== at + 1);
  if (files.length === 0) {
    console.error('usage: regate-checklist.mjs <report.json>... [--previous <checklist.json>]');
    process.exit(1);
  }
  const reports = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  const previous = previousFile ? JSON.parse(fs.readFileSync(previousFile, 'utf8')).rows : [];
  const list = regateChecklist(reports, previous);
  const out = files[0].replace(/\.json$/, '-checklist');
  fs.writeFileSync(`${out}.json`, JSON.stringify(list, null, 2));
  fs.writeFileSync(`${out}.md`, checklistMarkdown(list));
  console.error(
    `written ${out}.{json,md}: ${list.rows.length} rows, ${list.targets.length} targets`,
  );
}
