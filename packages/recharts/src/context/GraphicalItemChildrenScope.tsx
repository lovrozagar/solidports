import { children as resolveChildren } from 'solid-js';
import type { JSX } from '@solidjs/web';
/**
 * Wraps user JSX (e.g. <ErrorBar/>) so that:
 *  - createComponent(ErrorBar, ...) fires exactly once,
 *  - that single invocation captures the current owner — which must include
 *    both RegisterGraphicalItemId.Provider AND SetErrorBarContext.Provider,
 *  - subsequent re-renders of the descendant tree read the memoized nodes
 *    instead of re-minting ErrorBar (which would loop the addErrorBar
 *    dispatch through the store-feedback cycle).
 *
 * MUST be rendered inside SetErrorBarContext.Provider and inside the
 * RegisterGraphicalItemId children-fn scope. See GOTCHA-017.
 */
export function GraphicalItemChildrenScope(props: { children: JSX.Element }): JSX.Element {
	const resolved = resolveChildren(() => props.children)
	return <>{resolved()}</>
}
