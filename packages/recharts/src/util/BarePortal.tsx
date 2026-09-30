import {
	createEffect,
	createMemo,
	createRoot,
	getOwner,
	onCleanup,
	runWithOwner,
	type JSX,
} from "solid-js"
import { insert } from "solid-js/web"

/* Wrapper-less alternative to `solid-js/web::Portal`. Solid's Portal mounts a
 * `<div>` inside `mount` and inserts children there — that extra div breaks
 * upstream tests that assert `.recharts-wrapper > .recharts-tooltip-wrapper`
 * direct-child selectors. BarePortal inserts directly on `mount` so children
 * land at the requested level. */
export function BarePortal(props: {
	mount: HTMLElement | undefined
	children: JSX.Element
}): null {
	const owner = getOwner()
	createEffect(() => {
		const target = props.mount
		if (target == null) return
		const marker = document.createTextNode("")
		target.appendChild(marker)
		const dispose = createRoot((d) => {
			/* eslint-disable-next-line solid/reactivity -- createMemo inside runWithOwner must be assigned inline; owner-tree placement is the invariant */
			const content = runWithOwner(owner, () => createMemo(() => props.children))
			insert(target, content, marker)
			return d
		})
		onCleanup(() => {
			dispose()
			marker.remove()
		})
	})
	return null
}
