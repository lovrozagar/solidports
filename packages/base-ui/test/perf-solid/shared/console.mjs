// The browser bench's console capture (plan 3, leaf 1.9): every `console.warn` and
// `console.error` a scenario's page logs is checked against `known-warnings.json`, where each
// entry names the variant (`solid`, `react` or `*`), the kind, a pattern and the reason it is
// expected. A message no entry covers is a problem: the run fails, so no step adds a warning
// unnoticed. Page errors were already problems.

/**
 * @param {{ scenario: string, variant: string, kind: 'warn' | 'error', text: string }[]} entries
 * @param {{ variant: string, kind: string, pattern: string, reason: string }[]} known
 */
export function matchConsole(entries, known) {
  const compiled = known.map((entry) => ({ ...entry, regex: new RegExp(entry.pattern) }));
  const result = { known: [], unknown: [] };
  for (const entry of entries) {
    const hit = compiled.find(
      (k) =>
        (k.variant === '*' || k.variant === entry.variant) &&
        k.kind === entry.kind &&
        k.regex.test(entry.text),
    );
    if (hit) result.known.push({ ...entry, reason: hit.reason });
    else result.unknown.push(entry);
  }
  return result;
}
