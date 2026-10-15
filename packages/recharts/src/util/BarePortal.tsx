import {
  createEffect,
  createMemo,
  createRoot,
  getOwner,
  runWithOwner,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { insert } from '@solidjs/web';
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
	createEffect(
		() => props.mount,
		(target) => {
			if (target == null) return
			/* Children land between two markers so teardown can remove exactly what was inserted;
			   disposing the root alone leaves the inserted nodes in the mount. */
			const start = document.createTextNode("")
			const marker = document.createTextNode("")
			target.appendChild(start)
			target.appendChild(marker)
			/* The effect callback has no owner, and Solid 2 creates no root without one: the root
			   belongs to the component, which disposes it with itself. */
			const dispose = runWithOwner(owner, () =>
				createRoot((d) => {
					const content = createMemo(() => props.children)
					insert(target, content, marker)
					return d
				}),
			)
			return () => {
				dispose()
				let node = start.nextSibling
				while (node != null && node !== marker) {
					const next = node.nextSibling
					node.remove()
					node = next
				}
				start.remove()
				marker.remove()
			}
		},
	)
	return null
}
