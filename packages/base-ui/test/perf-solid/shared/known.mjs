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

/**
 * Whether a variant's summary matches the reference variant's: equal, or, across React and Solid,
 * different only as `known` allows. `knownDifference` takes React's summary first whichever variant
 * is the reference: the SSR bench's reference is its first variant, React in the forward order and
 * Solid in the swapped one, and a known node delta is Solid minus React.
 * @param {{ nodesDelta?: number, fields?: string[], reason: string } | undefined} known
 * @param {string | undefined} reference
 * @param {string | undefined} compared
 * @param {string} referenceLib
 * @param {string} comparedLib
 */
export function summariesMatch(known, reference, compared, referenceLib, comparedLib) {
  if (reference === compared) {
    return true;
  }
  if (referenceLib === comparedLib) {
    return false;
  }
  return referenceLib === 'react'
    ? knownDifference(known, reference, compared)
    : knownDifference(known, compared, reference);
}
