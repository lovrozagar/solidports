import {
	createStore as createStore2,
	omit,
	type Accessor,
	type Store,
	type StoreSetter,
} from "solid-js"
import { storePath } from "@solidjs/signals"

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never

type MergePropsResult<T extends unknown[]> = UnionToIntersection<
	Exclude<T[number], null | undefined>
>

/**
 * Solid 1.x mergeProps: later sources win, `undefined` is skipped.
 * Solid 2 `merge` treats `undefined` as a real override.
 */
export function mergeProps<T extends (object | null | undefined)[]>(
	...sources: T
): MergePropsResult<T> {
	const keys = new Set<string>()
	for (const source of sources) {
		if (!source) continue
		for (const key of Object.keys(source)) keys.add(key)
	}
	const target: Record<string, unknown> = {}
	for (const key of keys) {
		Object.defineProperty(target, key, {
			enumerable: true,
			configurable: true,
			get() {
				for (let i = sources.length - 1; i >= 0; i--) {
					const source = sources[i]
					if (!source) continue
					const value = (source as Record<string, unknown>)[key]
					if (value !== undefined) return value
				}
			},
			// Solid 1 mergeProps used a proxy `set` trap that no-ops. Without a
			// setter, assignment throws "which has only a getter" in Solid 2.
			set() {},
		})
	}
	return target as MergePropsResult<T>
}

function pickProps<T extends object>(props: T, keys: readonly (keyof T)[]) {
	const picked: Partial<T> = {}
	for (const key of keys) {
		Object.defineProperty(picked, key, {
			enumerable: true,
			configurable: true,
			get: () => props[key],
			set() {},
		})
	}
	return picked as Pick<T, (typeof keys)[number]>
}

export type SplitProps<T, K extends (readonly (keyof T)[])[]> = [
	...{
		[P in keyof K]: P extends `${number}`
			? Pick<T, Extract<K[P], readonly (keyof T)[]>[number]>
			: never
	},
	Omit<T, K[number][number]>,
]

/**
 * Solid 1.x splitProps: returns `[...pickedGroups, rest]`.
 */
export function splitProps<T extends object, const K extends (readonly (keyof T)[])[]>(
	props: T,
	...groups: K
): SplitProps<T, K> {
	const claimed = new Set<PropertyKey>()
	const result: unknown[] = []
	for (const group of groups) {
		const owned = group.filter(key => {
			if (claimed.has(key)) return false
			claimed.add(key)
			return true
		})
		result.push(pickProps(props, owned))
	}
	result.push(omit(props, ...(claimed as unknown as (keyof T)[])))
	return result as SplitProps<T, K>
}

type AccessorValue<A> = A extends () => infer V ? V : A
type OnDepsValue<D> = D extends readonly unknown[]
	? { [K in keyof D]: AccessorValue<D[K]> }
	: AccessorValue<D>

type EffectApply<T> = (value: T, prev?: T) => void | (() => void)

/**
 * Solid 1.x `on()` as a 2.0 `createEffect(...on(deps, fn))` spread.
 */
export function on<const D extends Accessor<unknown> | readonly Accessor<unknown>[]>(
	deps: D,
	fn: EffectApply<OnDepsValue<D>>,
	options: { defer?: boolean },
): [() => OnDepsValue<D>, EffectApply<OnDepsValue<D>>, { defer?: boolean }]
export function on<const D extends Accessor<unknown> | readonly Accessor<unknown>[]>(
	deps: D,
	fn: EffectApply<OnDepsValue<D>>,
): [() => OnDepsValue<D>, EffectApply<OnDepsValue<D>>]
export function on(
	deps: Accessor<unknown> | readonly Accessor<unknown>[],
	fn: EffectApply<any>,
	options?: { defer?: boolean },
): [() => any, EffectApply<any>, { defer?: boolean }?] {
	const compute = () => {
		if (Array.isArray(deps)) {
			return (deps as readonly Accessor<unknown>[]).map(dep =>
				typeof dep === "function" ? dep() : dep,
			)
		}
		return (deps as Accessor<unknown>)()
	}
	return options ? [compute, fn, options] : [compute, fn]
}

/** Solid 1.x createSelector. Fine-grained key isolation is not preserved. */
export function createSelector<T, U>(
	source: Accessor<T>,
	fn: (a: T, b: U) => boolean = (a, b) => a === (b as unknown as T),
): (key: U) => boolean {
	return (key: U) => fn(source(), key)
}

/** 1.x path-style store setter. Solid 2 `StoreSetter` is draft-only. */
export type SetStoreFunction<T> = {
	(fn: (state: T) => void): void
	(key: PropertyKey, fn: (value: any) => any, ...rest: any[]): void
	(...args: any[]): void
}

function pathHasFilter(args: unknown[]): boolean {
	return args.some(
		arg =>
			typeof arg === "function" ||
			(arg !== null &&
				typeof arg === "object" &&
				!Array.isArray(arg) &&
				("from" in (arg as object) ||
					"to" in (arg as object) ||
					"by" in (arg as object))),
	)
}

/** Solid 2 store drafts use getter-only nodes for `get x()` initial fields.
 *  Object.assign throws "which has only a getter"; skip those keys — they stay live. */
export function writeStorePatch(draft: any, patch: Record<string, unknown>) {
	for (const key of Object.keys(patch)) {
		const next = patch[key]
		try {
			if (Object.is(draft[key], next)) continue
			draft[key] = next
		} catch (error) {
			if (error instanceof TypeError && /only a getter/i.test(error.message)) {
				continue
			}
			throw error
		}
	}
}

function applyPath(set: StoreSetter<any>, args: any[]) {
	if (args.length === 0) return
	if (args.length === 1) {
		const arg = args[0]
		if (typeof arg === "function") {
			set(arg)
			return
		}
		if (arg && typeof arg === "object" && !Array.isArray(arg)) {
			set((draft: any) => {
				writeStorePatch(draft, arg)
			})
			return
		}
		set(storePath(arg as never) as never)
		return
	}

	const last = args[args.length - 1]
	const path = args.slice(0, -1)

	if (typeof last === "function" && !pathHasFilter(path)) {
		set((draft: any) => {
			let parent = draft
			for (let i = 0; i < path.length; i++) {
				const key = path[i]
				if (parent == null) return
				if (i === path.length - 1) {
					let current = parent[key]
					if (current == null) {
						/* Solid 2 reconcile throws on null/undefined. Seed a node so
						   first-write path setters (`set("fields", id, reconcile(obj))`)
						   match Solid 1 and create the nested record. */
						parent[key] = {}
						current = parent[key]
					}
					const result = last(current)
					if (result !== undefined && result !== current) {
						writeStorePatch(parent, { [key]: result })
					}
					return
				}
				if (parent[key] == null) {
					parent[key] = {}
				}
				parent = parent[key]
			}
		})
		return
	}

	set((storePath as any)(...args))
}

/**
 * Solid 1.x `createStore` with path setters (`set("a", "b", value)`).
 * Native Solid 2 setters only accept a draft function.
 */
export function createStore<T extends object>(
	initialValue: T,
	options?: { name?: string; shallow?: boolean },
): [Store<T>, SetStoreFunction<T>] {
	const [store, set] = createStore2(initialValue as any, options)
	const setCompat = ((...args: any[]) => {
		applyPath(set as unknown as StoreSetter<any>, args)
	}) as SetStoreFunction<T>
	return [store, setCompat]
}
