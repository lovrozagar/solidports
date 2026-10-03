import type { JSX } from '@solidjs/web';
import { untrack } from 'solid-js';
import { mergeProps } from './solid-1-compat';
import { ownStringKeys } from './svgPropertiesNoEvents';
/**
 * Solid-aware analogue of upstream React's defaultProps + spread pattern.
 *
 * Upstream React re-runs the component on every parent re-render, so a plain
 * `{...realProps}` spread is fine — a new resolved object is built each pass.
 * In Solid the component body runs ONCE and `realProps` is a lazy proxy whose
 * field getters back-propagate to upstream signals. A naive `{...realProps}`
 * spread eagerly invokes every getter and freezes the values at mount; downstream
 * computations never re-fire when upstream changes (verified: chart-offset legend
 * reflow lands but axis-line `<line>` y attrs stayed stale at the pre-reflow value).
 *
 * The visual debug fix moved to `mergeProps(defaults, realProps)` to restore that
 * reactivity, but a lazy proxy hits two further hazards in this codebase:
 *
 *   1. `children` re-evaluation. The Solid JSX `<Label/>` lives behind a getter on
 *      the parent's props proxy. Reading `realProps.children` re-invokes the getter
 *      and produces a NEW Label instance every read; downstream `{...props}`
 *      spreads enumerate keys and each spread re-reads children, ballooning into
 *      orphan DOM (regressed YAxis label test: 15× duplicate `<text>`).
 *
 *   2. Iteration order. `mergeProps` enumerates default keys first, so a downstream
 *      `{...resolved}` spread emits user-supplied keys AFTER defaults — flipping
 *      attribute order on `<path>` (regressed Pie inactive-shape test asserts on
 *      `getAttributeNames()` order).
 *
 * Strategy: build a plain object whose own-keys list mirrors realProps first then
 * defaults (matches upstream React `{...realProps}` order), back every key with a
 * getter that re-reads realProps lazily so reactivity is preserved, and snapshot
 * `children` ONCE up front so JSX-as-child doesn't multiply.
 */
export function resolveDefaultProps<T, D extends Partial<T>>(
	realProps: T,
	defaultProps: D & DisallowExtraKeys<T, D>,
): RequiresDefaultProps<T, D> {
	/* Key enumeration is structural (which props were passed). Solid 2 treats
	   Object.keys / `in` on a props or store proxy as a reactive read, and this
	   helper runs in the component body. Snapshot once; value getters stay live. */
	const realKeys: ReadonlyArray<string> = untrack(() =>
		/* ownStringKeys: Object.keys on a props proxy pays a descriptor trap per key. */
		isNonNullObject(realProps) ? ownStringKeys(realProps as object) : [],
	)
	const realKeySet = new Set(realKeys)
	const defaultKeys = Object.keys(defaultProps as object).filter((k) => !realKeySet.has(k))
	const orderedKeys = [...realKeys, ...defaultKeys]

	/* Element children (`<Label/>` lives behind a Solid getter that mints a fresh component
	   on each read) are read once, lazily, so they stay stable across downstream
	   `{...props}` spreads and are instantiated where the children are placed, under that
	   position's context providers. Primitive children (text from an expression such as
	   `{format(props.index)}`) carry no component and stay live: every read re-runs the
	   getter so the text tracks its inputs. */
	const realPropsHasChildren = untrack(
		() =>
			realProps != null && typeof realProps === "object" && "children" in (realProps as object),
	)
	let childrenMode: "unknown" | "primitive" | "element" = "unknown"
	let childrenSnapshot: JSX.Element | undefined
	const readChildren = (): JSX.Element | undefined => {
		if (childrenMode === "element") {
			return childrenSnapshot
		}
		const value = (realProps as unknown as { children: JSX.Element }).children
		if (childrenMode === "unknown") {
			childrenMode = isPrimitiveChild(value) ? "primitive" : "element"
			childrenSnapshot = value
		}
		return value
	}

	const target: Record<string, unknown> = {}
	const overrides: Record<string, unknown> = {}
	let hasOverride = false
	for (const key of orderedKeys) {
		Object.defineProperty(target, key, {
			configurable: true,
			enumerable: true,
			get() {
				if (hasOverride && key in overrides) {
					return overrides[key]
				}
				if (key === "children" && realPropsHasChildren) {
					return readChildren()
				}
				if (isNonNullObject(realProps)) {
					const v = (realProps as Record<string, unknown>)[key]
					if (v !== undefined) {
						return v
					}
				}
				return (defaultProps as Record<string, unknown>)[key]
			},
			/* Solid's ref assignment + downstream local-prop mutation paths write through
			   to the resolved object. Capture writes in an overrides bag so the getters
			   keep their reactive read paths but writers can stash refs/event handlers. */
			set(value: unknown) {
				hasOverride = true
				overrides[key] = value
			},
		})
	}
	return target as RequiresDefaultProps<T, D>
}

function isPrimitiveChild(value: unknown): boolean {
	return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object"
}

/* Re-export so callers that need a $PROXY-bearing proxy (e.g. `<Dynamic>` spreads)
   can opt in. Default consumers prefer the ordered target above. */
export { mergeProps }

/**
 * Helper type to extract the keys of T that are required.
 * It iterates through each key K in T. If Pick<T, K> cannot be assigned an empty object {},
 * it means K is required, so we keep K; otherwise, we discard it (never).
 * [keyof T] at the end creates a union of the kept keys.
 */
export type RequiredKeys<T> = {
	[K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]

/**
 * Helper type to extract the keys of T that are optional.
 * It iterates through each key K in T. If Pick<T, K> can be assigned an empty object {},
 * it means K is optional (or potentially missing), so we keep K; otherwise, we discard it (never).
 * [keyof T] at the end creates a union of the kept keys.
 */
export type OptionalKeys<T> = {
	[K in keyof T]-?: object extends Pick<T, K> ? K : never
}[keyof T]

/**
 * Helper type to ensure keys of D exist in T.
 * For each key K in D, if K is also a key of T, keep the type D[K].
 * If K is NOT a key of T, map it to type `never`.
 * An object cannot have a property of type `never`, effectively disallowing extra keys.
 */
export type DisallowExtraKeys<T, D> = { [K in keyof D]: K extends keyof T ? D[K] : never }

/**
 * This type will take a source type `Props` and a default type `Defaults` and will return a new type
 * where all properties that are optional in `Props` but required in `Defaults` are made required in the result.
 * Properties that are required in `Props` and optional in `Defaults` will remain required.
 * Properties that are optional in both `Props` and `Defaults` will remain optional.
 *
 * This is useful for creating a type that represents the resolved props of a component with default props.
 */
export type RequiresDefaultProps<Props, Defaults extends Partial<Props>> = Pick<
	Props,
	RequiredKeys<Props>
> &
	Required<Pick<Props, Extract<OptionalKeys<Props>, RequiredKeys<Defaults>>>> &
	Pick<Props, Exclude<OptionalKeys<Props>, keyof Defaults>>
