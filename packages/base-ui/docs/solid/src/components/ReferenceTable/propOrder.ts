import order from "../../../../../scripts/api-docs-builder/src/order.json"

const PROP_ORDER = order.props
const EVERYTHING_ELSE = "__EVERYTHING_ELSE__"
const everythingAt = PROP_ORDER.indexOf(EVERYTHING_ELSE)
const before = PROP_ORDER.slice(0, everythingAt < 0 ? PROP_ORDER.length : everythingAt)
const after = everythingAt < 0 ? [] : PROP_ORDER.slice(everythingAt + 1)

/** Same prop order as the React docs API tables (`order.json`). */
export function sortPropEntries<T>(data: Record<string, T>): [string, T][] {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  const present = new Set(Object.keys(data))
  const leading = before.filter((key) => present.has(key))
  const middle = Object.keys(data)
    .filter((key) => !beforeSet.has(key) && !afterSet.has(key))
    .sort()
  const trailing = after.filter((key) => present.has(key))
  return [...leading, ...middle, ...trailing].map((key) => [key, data[key]!])
}
