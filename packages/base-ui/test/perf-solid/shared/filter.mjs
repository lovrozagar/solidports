// The scenario and SSR-case filter shared by `run.mjs` and `ssr/run.mjs`: comma-separated terms,
// each an id prefix, `component:<name>` or `tag:<tag>`. Positive terms are OR'd (none: keep
// everything); a term starting with `!` excludes what it matches. `component:` matches every entry
// that lists the component; an id prefix selects by the primary component that names the id.
// Every value must exist: an unknown component or tag, or an id prefix no id starts with, throws.
//   accordion/raw   component:collapsible,!tag:raw   tag:ssr

const KINDS = new Set(['id', 'component', 'tag']);

/**
 * @typedef {{ kind: 'id' | 'component' | 'tag', value: string, exclude: boolean }} Term
 * @typedef {{ id: string, components?: readonly string[], tags?: readonly string[] }} Entry
 * @typedef {{ ids: readonly string[], components: readonly string[], tags: readonly string[] }} Known
 */

/** Edit distance, for the "did you mean" hint. @param {string} a @param {string} b */
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

/** @param {string} value @param {readonly string[]} options */
const closest = (value, options) =>
  options.reduce((best, option) =>
    distance(value, option) < distance(value, best) ? option : best,
  );

/**
 * Parses the terms and checks each value against `known` (the manifest vocabularies and the ids on
 * offer), so a typo throws instead of silently matching nothing.
 * @param {string | undefined} raw @param {Known} known @returns {Term[]}
 */
export function parseFilter(raw, known) {
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
      const value = colon === -1 ? body : body.slice(colon + 1);
      if (kind === 'id') {
        if (!known.ids.some((id) => id.startsWith(value))) {
          throw new Error(
            `No id starts with "${value}" in "${term}"; did you mean "${closest(value, known.ids)}"?`,
          );
        }
      } else {
        const options = kind === 'component' ? known.components : known.tags;
        if (!options.includes(value)) {
          throw new Error(
            `Unknown ${kind} "${value}" in "${term}"; did you mean "${closest(value, options)}"?`,
          );
        }
      }
      return { kind, value, exclude };
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
