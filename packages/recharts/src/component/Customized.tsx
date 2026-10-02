/**
 * @fileOverview Customized
 */
import { untrack } from 'solid-js';
import { splitProps } from '../util/solid-1-compat';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import { Layer } from "../container/Layer"

type Comp<P extends Record<string, unknown>> = Component<P> | JSX.Element
export type Props<P extends Record<string, unknown>, C extends Comp<P>> = P & {
	/**
	 * Render your components directly, without Customized wrapper. Will be removed in 4.0
	 * @deprecated
	 * @example Before: `<Customized component={<MyCustomComponent />} />`
	 * @example After: `<MyCustomComponent />`
	 */
	component: C
}

/**
 * Customized component used to be necessary to render custom elements in Recharts 2.x.
 * Starting from Recharts 3.x, all charts are able to render arbitrary elements anywhere,
 * and Customized is no longer needed.
 *
 * @example Before: `<Customized component={<MyCustomComponent />} />`
 * @example After: `<MyCustomComponent />`
 *
 * @deprecated Just render your components directly. Will be removed in 4.0
 */
export function Customized<P extends Record<string, unknown>, C extends Comp<P>>(
	allProps: Props<P, C>,
) {
	const [local, rest] = splitProps(allProps, ["component"])
	/* Read once: a JSX.Element getter would create the element again on each read.
	   The component prop is structural (deprecated wrapper), not reactive. */
	const component = untrack(() => local.component)
	const child: JSX.Element =
		typeof component === "function" ? (
			<Dynamic component={component as Component<Record<string, unknown>>} {...rest} />
		) : (
			/* Solid evaluates <Comp /> eagerly; components returning null yield null. */
			(component as JSX.Element)
		)

	return <Layer class="recharts-customized-wrapper">{child}</Layer>
}

Customized.displayName = "Customized"
