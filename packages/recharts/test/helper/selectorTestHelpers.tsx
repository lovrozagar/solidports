import { expect, it, vi } from "vitest"
import { trackSpy } from "./trackSpy"
import { render } from "./render"
import { useContext } from 'solid-js';
import { useAppSelector } from "../helper/legacyDispatch"
import { RechartsStoreContext } from "../../src/state/RechartsStoreContext"
import { createInitialState, createRechartsStore } from "../../src/state/store"
import type { ChartState } from "../../src/state/store"
import { createSelectorTestCase } from "./createSelectorTestCase"

/**
 * Uses the store context if available, otherwise returns undefined.
 * Unlike the production useAppSelector which throws outside context,
 * this returns undefined — matching the React+Redux behaviour
 * where useSelector returns undefined outside a Provider.
 */
function useAppSelectorSafe<T>(selector: (state: ChartState) => T): T | undefined {
	const ctx = useContext(RechartsStoreContext)
	if (ctx == null) return undefined
	return selector(ctx.store)
}

export function shouldReturnUndefinedOutOfContext(
	selector: (state: ChartState) => unknown,
): void {
	it("should return undefined when called out of Recharts context", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			trackSpy(spy, () => useAppSelectorSafe(selector))
			return null
		}
		render(() => <Comp />)
		expect(spy).toHaveBeenCalledWith(undefined)
		expect(spy).toHaveBeenCalledTimes(1)
	})
}

export function shouldReturnFromInitialState<T>(
	selector: (state: ChartState) => T,
	expectedReturn: T,
): void {
	const valueDescription = JSON.stringify(expectedReturn)
	it(`should return ${valueDescription} when called with initial state`, () => {
		const [store] = createRechartsStore()
		const result = selector(store)
		expect(result).toEqual(expectedReturn)
		const shouldBeStable = selector(store)
		expect(shouldBeStable).toEqual(expectedReturn)
		/* structural equality per GOTCHA-003 — Solid port does not memoize via reselect,
		   so selector output is not guaranteed to be referentially identical across calls. */
		expect(shouldBeStable).toEqual(result)
	})
}

/**
 * Do not use in production code. Test utility only.
 *
 * Renders inside a chart, captures the store via context, calls the
 * selector, rerenders the same component, calls again — asserts both
 * results structurally equal.
 *
 * Port note: upstream asserted referential identity (reselect memoization
 * + spy.calls bumping on every render). Solid fine-grained reactivity
 * does not re-fire effects when memoized values are structurally equal,
 * so the upstream "spy must tick twice" assertion never holds. Calling
 * the selector directly against the store sidesteps the memo entirely
 * and keeps the structural-equality contract — which is the real
 * guarantee per GOTCHA-003.
 */
export function assertStableBetweenRenders<T>(
	renderTestCase: ReturnType<typeof createSelectorTestCase>,
	selector: (state: ChartState) => T,
) {
	let storeRef: ChartState | undefined
	const StoreCapture = (): null => {
		const ctx = useContext(RechartsStoreContext)
		if (ctx == null) throw new Error("StoreCapture used outside RechartsStoreContext")
		storeRef = ctx.store
		return null
	}
	const { container, rerenderSameComponent } = renderTestCase(() => {
		StoreCapture()
		return undefined
	})
	if (storeRef == null) {
		throw new Error("assertStableBetweenRenders: store not captured — chart did not mount")
	}
	void container
	const firstResult = selector(storeRef)

	rerenderSameComponent()

	const secondResult = selector(storeRef)
	/* RechartsScale-bearing values have fresh closures per call (bandwidth/ticks/range/...);
	   strict deep-equal fails on function identity even when shape matches. Use the
	   function-aware equality from createSelectorTestCase. */
	expect(structuralEqualIgnoringFunctions(secondResult, firstResult)).toBe(true)
}

/* Function-aware deep equality: any two function-typed values are considered equal.
   Selectors returning RechartsScale or other closure-bearing objects (bandwidth,
   ticks, range, map, scale, ...) build fresh closures on every call, which fails
   vitest's .toEqual on the function properties. The structural shape and primitive
   payload are what we want to assert; function identity is implementation noise. */
function structuralEqualIgnoringFunctions(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (typeof a === "function" && typeof b === "function") return true
	if (a == null || b == null) return false
	if (typeof a !== "object" || typeof b !== "object") return false
	if (Array.isArray(a) !== Array.isArray(b)) return false
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!structuralEqualIgnoringFunctions(a[i], b[i])) return false
		}
		return true
	}
	const aKeys = Object.keys(a as Record<string, unknown>)
	const bKeys = Object.keys(b as Record<string, unknown>)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (!Object.hasOwn(b as Record<string, unknown>, key)) return false
		if (
			!structuralEqualIgnoringFunctions(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			)
		) {
			return false
		}
	}
	return true
}

/**
 * Do not use in production code. Test utility only.
 *
 * Wraps a selector so it runs twice on the same state and
 * asserts both calls return structurally-equal output.
 * Port note: upstream used `.toBe` (referential) because reselect memoized by input identity.
 * The Solid port replaces reselect with fine-grained reactivity (GOTCHA-003) — referential
 * stability is no longer a guaranteed property, and selectors returning objects with d3
 * scale closures (bandwidth/ticks/range/map) build fresh function refs on every call.
 * Structural equality with function-shape parity is the real contract.
 */
export function useAppSelectorWithStableTest<T>(
	selector: (state: ChartState) => T,
): T | undefined {
	return useAppSelector((state: ChartState) => {
		const result1 = selector(state)
		const result2 = selector(state)
		expect(structuralEqualIgnoringFunctions(result1, result2)).toBe(true)
		return result1
	})
}
