import { $PROXY, createMemo, onCleanup, runWithOwner } from "solid-js"
import type { Accessor, Owner } from "solid-js"
import type { ChartState } from "../chartState"

/*
 * Per-chart memoized selector graph — the Solid stand-in for upstream's reselect `createSelector`.
 *
 * A wrapped selector called with a chart store resolves to one memo per (selector, argument tuple),
 * owned by the chart provider and shared by every consumer. Each memo tracks only the store reads
 * and selector reads of its own body, so an upstream memo that did not change (by `equals`) stops
 * propagation exactly like a reselect cache hit.
 *
 * Stores without a registered owner (unit tests building a bare store, code outside a provider)
 * call the raw function, so behavior is identical either way.
 */

type Selector<A extends unknown[], R> = (state: ChartState, ...args: A) => R

type ArgNode = {
	memo: Accessor<unknown> | undefined
	children: Map<unknown, ArgNode> | undefined
}

type ChartCache = { owner: Owner; roots: WeakMap<object, ArgNode> }

const chartCaches = new WeakMap<ChartState, ChartCache>()

const newNode = (): ArgNode => ({ children: undefined, memo: undefined })

const isObjectArg = (value: unknown): boolean =>
	(typeof value === "object" && value !== null) || typeof value === "function"

/* Map keys use SameValueZero, so undefined and NaN are valid keys without a sentinel. */
function childNode(node: ArgNode, key: unknown): ArgNode {
	node.children ??= new Map()
	let next = node.children.get(key)
	if (next === undefined) {
		next = newNode()
		node.children.set(key, next)
	}
	return next
}

const isStoreNode = (value: object): boolean => (value as { [$PROXY]?: unknown })[$PROXY] !== undefined

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

/**
 * Default output equality: `===`, then element-wise `===` for arrays, then own-key shallow `===`
 * for plain non-store objects. Never deep — data arrays are compared by element identity only.
 */
export function defaultSelectorEquals(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true
	}
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) {
			return false
		}
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false
			}
		}
		return true
	}
	/* Distinct store nodes are never equal: keeping the old node would leave readers tracking
	   a different live object than the one the selector now resolves to. */
	if (!isPlainObject(a) || !isPlainObject(b) || isStoreNode(a) || isStoreNode(b)) {
		return false
	}
	const aKeys = Object.keys(a)
	if (aKeys.length !== Object.keys(b).length) {
		return false
	}
	for (const key of aKeys) {
		if (a[key] !== b[key] || !(key in b)) {
			return false
		}
	}
	return true
}

/**
 * Binds a chart store to the owner its selector memos live under. Called once per chart provider;
 * the cache is dropped when that owner is disposed.
 */
export function registerChartOwner(state: ChartState, owner: Owner | null): void {
	if (owner == null) {
		return
	}
	chartCaches.set(state, { owner, roots: new WeakMap() })
	onCleanup(() => {
		chartCaches.delete(state)
	})
}

/** The owner registered for a chart store, if any. */
export function ownerFor(state: ChartState): Owner | undefined {
	return chartCaches.get(state)?.owner
}

/*
 * A memo keyed by stale arguments (an old settings node) can recompute in the same flush that its
 * consumer will use to switch to new arguments. Errors are therefore captured and rethrown only to
 * a reader, so a discarded stale computation never halts the reactive system.
 */
class SelectorError {
	constructor(readonly error: unknown) {}
}

const withErrorBox = (equals: (prev: unknown, next: unknown) => boolean) => (prev: unknown, next: unknown) =>
	!(prev instanceof SelectorError) && !(next instanceof SelectorError) && equals(prev, next)

export type ChartSelectorOptions<R> = {
	equals?: (prev: R, next: R) => boolean
}

/**
 * Wraps a selector so calls on a provider-owned chart store share one memo per argument tuple.
 * Same signature as `fn`.
 *
 * Only all-primitive tuples are memoized. A call carrying an object argument (settings node,
 * cells, overrides) runs the raw function: a memo closed over a settings node that was later
 * replaced would keep recomputing against new data until its consumer let go, running stale
 * user callbacks such as a previous `dataKey` (recharts#4935).
 *
 * Do not wrap selectors whose arguments span an unbounded primitive space (pointer coordinates):
 * every distinct tuple keeps a trie entry for the chart's lifetime.
 *
 * Memos are lazy: an unobserved memo goes dormant (detached from its sources and the owner)
 * instead of recomputing on every write, and a later read reawakens it, so untracked readers such
 * as event middleware cost no more than the raw function.
 */
export function chartSelector<A extends unknown[], R>(
	fn: Selector<A, R>,
	options?: ChartSelectorOptions<R>,
): Selector<A, R> {
	const equals = withErrorBox((options?.equals ?? defaultSelectorEquals) as (prev: unknown, next: unknown) => boolean)
	const selector = (state: ChartState, ...args: A): R => {
		const cache = chartCaches.get(state)
		if (cache === undefined) {
			return fn(state, ...args)
		}
		let node = cache.roots.get(fn)
		if (node === undefined) {
			node = newNode()
			cache.roots.set(fn, node)
		}
		for (const arg of args) {
			if (isObjectArg(arg)) {
				return fn(state, ...args)
			}
			node = childNode(node, arg)
		}
		let memo = node.memo
		if (memo === undefined) {
			const compute = (): unknown => {
				try {
					return fn(state, ...args)
				} catch (error) {
					return new SelectorError(error)
				}
			}
			memo = runWithOwner(cache.owner, () =>
				createMemo<unknown>(compute, { equals, lazy: true, sync: true, transparent: true }),
			)
			node.memo = memo
		}
		const value = memo()
		if (value instanceof SelectorError) {
			throw value.error
		}
		return value as R
	}
	/* Keep the arity of the wrapped function; hook-compat checks read `selector.length`. */
	Object.defineProperty(selector, "length", { value: fn.length })
	return selector
}
