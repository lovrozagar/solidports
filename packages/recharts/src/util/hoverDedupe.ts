/**
 * React derives onMouseEnter/onMouseLeave from the bubbling mouseover/mouseout events. Solid binds
 * native events 1:1, so items bind both pairs; one pointer move then fires both mouseover and
 * mouseenter (and mouseout + mouseleave), which must dispatch once.
 *
 * Shared by one list of items: entering another item ends the previous entry, the way moving the
 * pointer from one item to the next does, so re-entering an item always dispatches again. A
 * mouseout into the item's own descendant is not a leave.
 */
export type HoverDedupe = {
	/** True when this enter event should dispatch. */
	enter(event: Event): boolean
	/** True when this leave event should dispatch. */
	leave(event: Event): boolean
}

export function createHoverDedupe(): HoverDedupe {
	let current: EventTarget | null = null
	return {
		enter(event) {
			const target = event.currentTarget
			if (target == null || current === target) {
				return false
			}
			current = target
			return true
		},
		leave(event) {
			const target = event.currentTarget
			if (target == null || current !== target) {
				return false
			}
			const next = (event as MouseEvent).relatedTarget
			if (event.type === "mouseout" && next instanceof Node && target instanceof Node && target.contains(next)) {
				return false
			}
			current = null
			return true
		},
	}
}
