// The docs crawl's console check (plan 3, leaf 1.11), as the browser bench's (`shared/console.mjs`):
// every console warning and error a docs page logs is a problem unless `known-console.json` lists
// it with a reason, and a message about hydration is a problem at any level, listed or not.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchConsole } from '../../test/perf-solid/shared/console.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The listed messages (`known-console.json`). */
export const KNOWN_DOCS_CONSOLE = JSON.parse(
  fs.readFileSync(path.join(here, 'known-console.json'), 'utf8'),
).entries;

/**
 * The problem a console message is, or `null`.
 * @param {{ type: string, text: string }} message `type` as Playwright reports it
 * @param {{ variant: string, kind: string, pattern: string, reason: string }[]} known
 */
export function consoleProblem(message, known = KNOWN_DOCS_CONSOLE) {
  const problem = `console ${message.type}: ${message.text.slice(0, 240)}`;
  if (/hydrat/i.test(message.text)) return problem;
  const kind = { warning: 'warn', error: 'error' }[message.type];
  if (!kind) return null;
  const { unknown } = matchConsole(
    [{ scenario: '', variant: 'docs', kind, text: message.text }],
    known,
  );
  return unknown.length ? problem : null;
}
