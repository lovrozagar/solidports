/**
 * Whether two DOM summaries (JSON strings, React's first) differ only as a `known-differences.json`
 * entry allows: a node delta (`nodesDelta`, Solid minus React) or named summary fields (`fields`)
 * ignored; every other part of the summary must still match. Shared by the browser bench's step
 * summaries and the SSR bench's hydrated summaries.
 * @param {{ nodesDelta?: number, fields?: string[], reason: string } | undefined} known
 * @param {string | undefined} expected
 * @param {string | undefined} actual
 */
export function knownDifference(known, expected, actual) {
  if (!known) {
    return false;
  }
  const nodes = (summary) => JSON.parse(summary ?? 'null')?.nodes;
  const without = (summary) => {
    const value = { ...JSON.parse(summary ?? '{}') };
    for (const field of known.fields ?? []) {
      delete value[field];
    }
    if (known.nodesDelta !== undefined) {
      value.nodes = 0;
    }
    return JSON.stringify(value);
  };
  const nodesOk =
    known.nodesDelta === undefined || nodes(actual) - nodes(expected) === known.nodesDelta;
  return nodesOk && without(actual) === without(expected);
}
