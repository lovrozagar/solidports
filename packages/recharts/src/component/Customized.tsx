/**
 * @fileOverview Customized
 */
import { type Component, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

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
	let child: JSX.Element | undefined

	/* eslint-disable solid/reactivity -- Customized is a deprecated wrapper; component prop is structural/stable, not reactive at runtime */
	if (typeof allProps.component === "function") {
		const { component, ...rest } = allProps
		child = <Dynamic component={component as Component<Record<string, unknown>>} {...rest} />
	} else {
		/*
		 * In Solid, <Comp /> eagerly evaluates — components returning null yield null.
		 * Accept any value including null (spy components in tests return null).
		 */
		child = allProps.component as JSX.Element
	}
	/* eslint-enable solid/reactivity */

	return <Layer class="recharts-customized-wrapper">{child}</Layer>
}

Customized.displayName = "Customized"
