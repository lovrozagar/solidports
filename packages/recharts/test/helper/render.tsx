import { fireEvent as domFireEvent, render as solidRender } from "@solidjs/testing-library"
import { flush } from "solid-js"

export * from "@solidjs/testing-library"

/**
 * Solid 2 queues effect-driven store writes on a microtask. React Testing Library wraps
 * `render` in `act`, so upstream assertions expect a settled chart right after mount.
 */
export function render(...args: Parameters<typeof solidRender>): ReturnType<typeof solidRender> {
	const result = solidRender(...args)
	flush()
	return result
}

type FireEventArgs = Parameters<typeof domFireEvent.mouseEnter>

/**
 * Upstream specs are written against React Testing Library, whose `fireEvent.mouseEnter`
 * and `fireEvent.mouseLeave` also dispatch `mouseover`/`mouseout` (and the pointer
 * equivalents), because React derives enter/leave from the bubbling over/out events.
 * A bare `mouseenter` does not bubble, so without this a chart-level handler never sees
 * an enter fired on a child element.
 */
export const fireEvent: typeof domFireEvent = Object.assign(
	(...args: Parameters<typeof domFireEvent>) => domFireEvent(...args),
	domFireEvent,
	{
		mouseEnter: (...args: FireEventArgs) => {
			domFireEvent.mouseEnter(...args)
			return domFireEvent.mouseOver(...args)
		},
		mouseLeave: (...args: FireEventArgs) => {
			domFireEvent.mouseLeave(...args)
			return domFireEvent.mouseOut(...args)
		},
		pointerEnter: (...args: FireEventArgs) => {
			domFireEvent.pointerEnter(...args)
			return domFireEvent.pointerOver(...args)
		},
		pointerLeave: (...args: FireEventArgs) => {
			domFireEvent.pointerLeave(...args)
			return domFireEvent.pointerOut(...args)
		},
	},
)
