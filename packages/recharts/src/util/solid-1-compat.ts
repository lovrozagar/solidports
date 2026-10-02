import {
	createStore as createStore2,
	omit,
	untrack,
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
 * Solid 2 compiles `ref={props.ref}` to `props.ref = el` when the value is not a
 * function. Getter-only merge/split views throw; keep a local override bag.
 */
function defineWritableProp(
	target: object,
	key: PropertyKey,
	getValue: () => unknown,
	overrides: Record<PropertyKey, unknown>,
) {
	Object.defineProperty(target, key, {
		enumerable: true,
		configurable: true,
		get() {
			return Object.prototype.hasOwnProperty.call(overrides, key)
				? overrides[key]
				: getValue()
		},
		set(value: unknown) {
			overrides[key] = value
		},
	})
}

/**
 * Call a Solid 2 ref without assigning onto getter-only merge/split props.
 */
export function bindRef<T>(ref: unknown, el: T): void {
	if (typeof ref === "function") {
		;(ref as (node: T) => void)(el)
		return
	}
	if (Array.isArray(ref)) {
		for (const item of ref) bindRef(item, el)
	}
}

/**
 * Solid 1.x mergeProps: later sources win, `undefined` is skipped.
 * Solid 2 `merge` treats `undefined` as a real override.
 */
export function mergeProps<T extends (object | null | undefined)[]>(
	...sources: T
): MergePropsResult<T> {
	const keys = new Set<string>()
	untrack(() => {
		for (const source of sources) {
			if (!source) continue
			for (const key of Object.keys(source)) keys.add(key)
		}
	})
	const overrides: Record<PropertyKey, unknown> = {}
	const target: Record<string, unknown> = {}
	for (const key of keys) {
		defineWritableProp(
			target,
			key,
			() => {
				for (let i = sources.length - 1; i >= 0; i--) {
					const source = sources[i]
					if (!source) continue
					const value = (source as Record<string, unknown>)[key]
					if (value !== undefined) return value
				}
			},
			overrides,
		)
	}
	return target as MergePropsResult<T>
}

function pickProps<T extends object>(props: T, keys: readonly (keyof T)[]) {
	const picked: Partial<T> = {}
	const overrides: Record<PropertyKey, unknown> = {}
	for (const key of keys) {
		defineWritableProp(picked, key, () => props[key], overrides)
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
	return untrack(() => {
		const claimed = new Set<PropertyKey>()
		const result: unknown[] = []
		for (const group of groups) {
			const owned = group.filter((key) => {
				if (claimed.has(key)) return false
				claimed.add(key)
				return true
			})
			result.push(pickProps(props, owned))
		}
		result.push(omit(props, ...(claimed as unknown as (keyof T)[])))
		return result as SplitProps<T, K>
	})
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

type PathValue<T> = T | Partial<T> | ((prev: T) => T | Partial<T> | void)
type At<T, K> = K extends keyof NonNullable<T> ? NonNullable<T>[K] : never

/** 1.x path-style store setter. Solid 2 `StoreSetter` is draft-only. */
export interface SetStoreFunction<T> {
	(setter: (draft: T) => void): void
	<K1 extends keyof T>(k1: K1, value: PathValue<T[K1]>): void
	<K1 extends keyof T, K2 extends keyof NonNullable<T[K1]>>(
		k1: K1,
		k2: K2,
		value: PathValue<At<T[K1], K2>>,
	): void
	<K1 extends keyof T, K2 extends keyof NonNullable<T[K1]>, K3 extends keyof NonNullable<At<T[K1], K2>>>(
		k1: K1,
		k2: K2,
		k3: K3,
		value: PathValue<At<At<T[K1], K2>, K3>>,
	): void
	<
		K1 extends keyof T,
		K2 extends keyof NonNullable<T[K1]>,
		K3 extends keyof NonNullable<At<T[K1], K2>>,
		K4 extends keyof NonNullable<At<At<T[K1], K2>, K3>>,
	>(
		k1: K1,
		k2: K2,
		k3: K3,
		k4: K4,
		value: PathValue<At<At<At<T[K1], K2>, K3>, K4>>,
	): void
	<
		K1 extends keyof T,
		K2 extends keyof NonNullable<T[K1]>,
		K3 extends keyof NonNullable<At<T[K1], K2>>,
		K4 extends keyof NonNullable<At<At<T[K1], K2>, K3>>,
		K5 extends keyof NonNullable<At<At<At<T[K1], K2>, K3>, K4>>,
	>(
		k1: K1,
		k2: K2,
		k3: K3,
		k4: K4,
		k5: K5,
		value: PathValue<At<At<At<At<T[K1], K2>, K3>, K4>, K5>>,
	): void
	<
		K1 extends keyof T,
		K2 extends keyof NonNullable<T[K1]>,
		K3 extends keyof NonNullable<At<T[K1], K2>>,
		K4 extends keyof NonNullable<At<At<T[K1], K2>, K3>>,
		K5 extends keyof NonNullable<At<At<At<T[K1], K2>, K3>, K4>>,
		K6 extends keyof NonNullable<At<At<At<At<T[K1], K2>, K3>, K4>, K5>>,
	>(
		k1: K1,
		k2: K2,
		k3: K3,
		k4: K4,
		k5: K5,
		k6: K6,
		value: PathValue<At<At<At<At<At<T[K1], K2>, K3>, K4>, K5>, K6>>,
	): void
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
				Object.assign(draft, arg)
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
				if (i === path.length - 1) {
					const current = parent[key]
					const result = last(current)
					if (result !== undefined) parent[key] = result
					return
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
