/* @jsxImportSource solid-js */
import {
	createMemo,
	createRenderEffect,
	createSignal,
	on,
	type Component,
	type JSX,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import type { Mock } from "vitest"
import { vi } from "vitest"
import { render } from "@solidjs/testing-library"
import { useAppSelectorWithStableTest } from "./selectorTestHelpers"
import type { ChartState } from "../../src/state/store"
import type { MockAnimationManager } from "../animation/MockProgressAnimationManager"
import { assertUniqueHtmlIds } from "../util/assertUniqueHtmlIds"
import { AnimationManagerContext } from "../../src/animation/useAnimationManager"
import { CompositeAnimationManager } from "../animation/CompositeAnimationManager"

/* Function-aware structural equality. Selectors returning RechartsScale-bearing
   objects build fresh function closures (bandwidth/ticks/range/map) on every call;
   .toBe / Object.is fails on those even when the underlying scale is identical.
   Treat any two functions as equal so the memo can dedupe value-equal re-runs and
   still match React's bailout-by-equality semantics from useSelector. */
function spyEquals(prev: unknown, next: unknown): boolean {
	if (Object.is(prev, next)) return true
	if (typeof prev === "function" && typeof next === "function") return true
	if (prev == null || next == null) return false
	if (typeof prev !== "object" || typeof next !== "object") return false
	if (Array.isArray(prev) !== Array.isArray(next)) return false
	if (Array.isArray(prev) && Array.isArray(next)) {
		if (prev.length !== next.length) return false
		for (let i = 0; i < prev.length; i++) {
			if (!spyEquals(prev[i], next[i])) return false
		}
		return true
	}
	const aKeys = Object.keys(prev as Record<string, unknown>)
	const bKeys = Object.keys(next as Record<string, unknown>)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (!Object.hasOwn(next as Record<string, unknown>, key)) return false
		if (
			!spyEquals(
				(prev as Record<string, unknown>)[key],
				(next as Record<string, unknown>)[key],
			)
		) {
			return false
		}
	}
	return true
}

type TestCaseResult<T> = {
	animationManager: MockAnimationManager
	container: HTMLElement
	debug: () => void
	getByText: (text: string) => HTMLElement
	queryByText: (text: string) => HTMLElement | null
	/**
	 * Rerender the whole test case with a different component.
	 */
	rerender: (NextComponent: Component<{ children: JSX.Element }>) => void
	/**
	 * Rerender the same component as before.
	 * Useful for testing updates and stable references.
	 */
	rerenderSameComponent: () => void
	spy: Mock<(selectorResult: T | undefined) => void>
	unmount: () => void
}

export type SolidHook<T> = {
	(): T
}

/* Solid hooks take no args; Redux-style selectors take state (+ optional args).
   Arity-based detection survives anonymous arrow wrappers (() => useFoo()). */
function isSolidHook<T>(fn: SolidHook<T> | ((state: ChartState) => T)): fn is SolidHook<T> {
	return fn.length === 0 || /^use[A-Z].*$/.test(fn.name)
}

function getComp<T>(
	selector: SolidHook<T> | ((state: ChartState) => T) | undefined,
	spy: Mock<(selectorResult: T | undefined) => void>,
	generation: () => number,
): () => null {
	if (selector == null) {
		return (): null => null
	}
	if (isSolidHook(selector)) {
		return (): null => {
			/* Hooks return bare T (GOTCHA-011). Call selector() inside the
			   memo so its store-proxy reads track and the memo re-runs on
			   each store change. spyEquals collapses RechartsScale closure
			   identity so the spy fires only on real shape changes.
			   generation() forces re-fire when rerenderSameComponent
			   runs against the same state. */
			const value = createMemo<T | undefined>(
				() => {
					generation()
					return selector()
				},
				undefined,
				{ equals: spyEquals },
			)
			createRenderEffect(on(value, (v) => spy(v)))
			return null
		}
	}
	return (): null => {
		const value = createMemo<T | undefined>(
			() => {
				generation()
				return useAppSelectorWithStableTest(selector)
			},
			undefined,
			{ equals: spyEquals },
		)
		createRenderEffect(on(value, (v) => spy(v)))
		return null
	}
}

/**
 * Test helper to create a multi-render test case for a selector.
 * It renders a component that uses the selector and spies on its output.
 *
 * In Solid, components run once. "Rerendering" is achieved by swapping
 * the wrapper component via a signal + Dynamic, and re-mounting the
 * spy component.
 *
 * @param InitialComponent The component to render. Must accept children.
 * @returns A function that renders the test case with a given selector.
 */
export function createSelectorTestCase(InitialComponent: Component<{ children: JSX.Element }>) {
	return function renderTestCase<T>(
		selector?: SolidHook<T> | ((state: ChartState) => T) | undefined,
	): TestCaseResult<T> {
		const spy: Mock<(selectorResult: T | undefined) => void> = vi.fn()
		const animationManager = new CompositeAnimationManager()

		const [getWrapper, setWrapper] = createSignal(InitialComponent, { equals: false })

		/**
		 * A generation counter that increments on each "rerender".
		 * Solid components run once so swapping to the same component
		 * reference won't remount. Reading generation() inside the spy
		 * effect forces it to re-fire on rerenderSameComponent.
		 */
		const [generation, setGeneration] = createSignal(0)

		const Comp = getComp(selector, spy, generation)

		const { container, debug, getByText, queryByText, unmount } = render(() => (
			<AnimationManagerContext.Provider value={animationManager.factory}>
				<Dynamic component={getWrapper()}>
					<Comp />
				</Dynamic>
			</AnimationManagerContext.Provider>
		))

		/* vitest 4.1.3 + fake-timers-in-setup-file hang on runOnlyPendingTimers/runAllTimers.
		   advanceTimersByTime(0) flushes same-tick pending without the hang. */
		vi.advanceTimersByTime(0)
		assertUniqueHtmlIds(container)

		const myRerender = (NextComponent: Component<{ children: JSX.Element }>): void => {
			setWrapper(() => NextComponent)
			setGeneration((g) => g + 1)
			vi.advanceTimersByTime(0)
		}

		const rerenderSameComponent = () => {
			myRerender(InitialComponent)
		}

		return {
			animationManager,
			container,
			debug,
			getByText,
			queryByText,
			rerender: myRerender,
			rerenderSameComponent,
			spy,
			unmount,
		}
	}
}

type RenderResult = {
	animationManager: MockAnimationManager
	container: HTMLElement
	debug: () => void
	getByText: (text: string) => HTMLElement
	queryByText: (text: string) => HTMLElement | null
	rerender: (next: () => JSX.Element) => void
	rerenderSameComponent: () => void
	unmount: () => void
}

/**
 * Render a Recharts chart (or part of it) for testing purposes.
 *
 * Drop-in replacement for testing-library's render, with
 * additional support for Recharts internals such as AnimationManager
 * and automatic HTML ID checking.
 */
export function rechartsTestRender(chart: () => JSX.Element): RenderResult {
	/* `chart` is the JSX under test; render it as the wrapper body. The Comp slot
	   (<Comp /> inside Dynamic) stays as the children — no spy is attached here so
	   it renders to nothing. Earlier helper version rendered only `props.children`,
	   discarding the `chart` argument and leaving every rechartsTestRender test
	   essentially empty. */
	const Wrapper: Component<{ children: JSX.Element }> = (props) => (
		<>
			{chart()}
			{props.children}
		</>
	)
	const testBundle = createSelectorTestCase(Wrapper)()
	return {
		...testBundle,
		rerender: (nextChart: () => JSX.Element) => {
			const Next: Component<{ children: JSX.Element }> = (props) => (
				<>
					{nextChart()}
					{props.children}
				</>
			)
			testBundle.rerender(Next)
		},
		rerenderSameComponent: () => {
			testBundle.rerenderSameComponent()
		},
	}
}

/**
 * Create a test case for two (or three) components and render
 * the same spy inside all of them.
 * Useful for testing synchronisation.
 */
export function createSynchronisedSelectorTestCase(
	ComponentA: Component<{ children: JSX.Element }>,
	ComponentB: Component<{ children: JSX.Element }>,
	ComponentC?: Component<{ children: JSX.Element }>,
) {
	return function renderTestCase<T>(
		selector: (state: ChartState) => T | undefined = () => undefined,
	): {
		container: Element
		debug: () => void
		spyA: Mock<(selectorResult: T | undefined) => void>
		spyB: Mock<(selectorResult: T | undefined) => void>
		spyC: Mock<(selectorResult: T | undefined) => void>
		wrapperA: Element
		wrapperB: Element
		wrapperC: Element | null
	} {
		const spyA: Mock<(selectorResult: T | undefined) => void> = vi.fn()
		const spyB: Mock<(selectorResult: T | undefined) => void> = vi.fn()
		const spyC: Mock<(selectorResult: T | undefined) => void> = vi.fn()

		/* Setup-time selector reads see the pre-dispatch initial state and never refresh
		   (GOTCHA-006-B / GOTCHA-007-B). Wrap reads in a memo + render effect so the
		   spy fires whenever the tracked dependencies flip — required for cross-chart
		   sync where chart B's mouseover dispatches into chart A's store via the event
		   bus AFTER both wrappers have completed setup. */
		const trackedSpy = <U,>(spy: Mock<(value: U | undefined) => void>): (() => null) => {
			return (): null => {
				const value = createMemo<U | undefined>(
					() => useAppSelectorWithStableTest(selector) as U | undefined,
					undefined,
					{ equals: spyEquals },
				)
				createRenderEffect(on(value, (v) => spy(v)))
				return null
			}
		}
		const CompA = trackedSpy(spyA)
		const CompB = trackedSpy(spyB)
		const CompC = trackedSpy(spyC)

		const { container, debug } = render(() => (
			<>
				<div id="wrapperA">
					<ComponentA>
						<CompA />
					</ComponentA>
				</div>
				<div id="wrapperB">
					<ComponentB>
						<CompB />
					</ComponentB>
				</div>
				{ComponentC && (
					<div id="wrapperC">
						<ComponentC>
							<CompC />
						</ComponentC>
					</div>
				)}
			</>
		))

		assertUniqueHtmlIds(container)
		const wrapperA = container.querySelector("#wrapperA")
		const wrapperB = container.querySelector("#wrapperB")
		const wrapperC = container.querySelector("#wrapperC")

		if (wrapperA == null || wrapperB == null) {
			throw new Error("Expected wrapperA and wrapperB to exist")
		}

		return {
			container,
			debug,
			spyA,
			spyB,
			spyC,
			wrapperA,
			wrapperB,
			wrapperC,
		}
	}
}
