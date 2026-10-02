/* @jsxImportSource @solidjs/web */
import { render } from "./render"
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
/**
 * Result of {@link renderWithSignals}. Extends the testing-library `render`
 * return with signal-backed prop update hooks.
 *
 * @see {@link renderWithSignals}
 */
export type Controlled<P extends Record<string, unknown>> = ReturnType<typeof render> & {
	/** Merge-patch props — prior keys retained, new keys overwrite. */
	update: (patch: Partial<P>) => void
	/** Drop-in React-style rerender — replaces props wholesale. */
	rerender: (nextProps: P) => void
}

/**
 * Signal-backed render for tests that need React-style `rerender(<X prop=new/>)`.
 *
 * Solid components run once; updates happen via signal mutation. The factory
 * is invoked with a *reactive proxy* whose property reads route through the
 * signal — so factory bodies that destructure or template-interpolate `p.x`
 * still respond to `update({ x: ... })`. A naive `factory(props())` snapshots
 * once and never updates.
 *
 * Companion of `.kb/solid/testing-quirks.md`. See GOTCHA bucket "test-helper"
 * in `.kb/concepts/test-triage.md` — React→Solid delta #3.
 *
 * @example
 * ```tsx
 * const { update, container } = renderWithSignals(
 *   p => <LineChart data={p.data} />,
 *   { data: initial },
 * )
 * update({ data: next })
 * ```
 */
export function renderWithSignals<P extends Record<string, unknown>>(
	factory: (props: P) => JSX.Element,
	initialProps: P,
): Controlled<P> {
	const [props, setProps] = createSignal<P>(initialProps)
	/* Reactive proxy: every read goes through the signal, so factory bodies
	 * that capture `p` and forward `p.foo` into JSX still see live values. */
	const reactiveProps = new Proxy({} as P, {
		get(_target, key) {
			return props()[key as keyof P]
		},
		has(_target, key) {
			return key in props()
		},
		ownKeys() {
			return Reflect.ownKeys(props())
		},
		getOwnPropertyDescriptor(_target, key) {
			const desc = Object.getOwnPropertyDescriptor(props(), key)
			if (desc) {
				return { ...desc, configurable: true }
			}
			return undefined
		},
	})
	const result = render(() => factory(reactiveProps))
	return {
		...result,
		rerender(nextProps: P): void {
			setProps(() => nextProps)
			flush()
		},
		update(patch: Partial<P>): void {
			setProps((prev) => ({ ...prev, ...patch }))
			flush()
		},
	}
}
