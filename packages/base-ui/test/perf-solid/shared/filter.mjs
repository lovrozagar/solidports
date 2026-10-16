// The scenario and SSR-case filter shared by `run.mjs` and `ssr/run.mjs`: comma-separated terms,
// each an id prefix, `component:<name>` or `tag:<tag>`. Positive terms are OR'd (none: keep
// everything); a term starting with `!` excludes what it matches.
//   accordion/raw   component:collapsible,!tag:raw   tag:ssr

const KINDS = new Set(['id', 'component', 'tag']);

/**
 * @typedef {{ kind: 'id' | 'component' | 'tag', value: string, exclude: boolean }} Term
 * @typedef {{ id: string, components?: readonly string[], tags?: readonly string[] }} Entry
 */

/** @param {string | undefined} raw @returns {Term[]} */
export function parseFilter(raw) {
  return (raw ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => {
      const exclude = term.startsWith('!');
      const body = exclude ? term.slice(1) : term;
      const colon = body.indexOf(':');
      const kind = colon === -1 ? 'id' : body.slice(0, colon);
      if (!KINDS.has(kind)) {
        throw new Error(
          `Unknown filter kind ${kind} in "${term}"; use an id prefix, component: or tag:`,
        );
      }
      return { kind, value: colon === -1 ? body : body.slice(colon + 1), exclude };
    });
}

/** @param {Entry} entry @param {Term} term */
function matchesTerm(entry, term) {
  if (term.kind === 'component') return (entry.components ?? []).includes(term.value);
  if (term.kind === 'tag') return (entry.tags ?? []).includes(term.value);
  return entry.id.startsWith(term.value);
}

/** @param {Entry} entry @param {Term[]} terms */
export function matchesFilter(entry, terms) {
  const include = terms.filter((term) => !term.exclude);
  if (include.length > 0 && !include.some((term) => matchesTerm(entry, term))) return false;
  return !terms.some((term) => term.exclude && matchesTerm(entry, term));
}
