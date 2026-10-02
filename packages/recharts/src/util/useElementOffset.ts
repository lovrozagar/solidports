import { createSignal, untrack, createEffect } from 'solid-js';
const EPS = 1

/**
 * Stores the `offsetHeight`, `offsetLeft`, `offsetTop`, and `offsetWidth` of a DOM element.
 */
export type ElementOffset = {
	/**
	 * Height of an element, including vertical padding and borders, as an integer.
	 *
	 * Typically, offsetHeight is a measurement in pixels of the element's CSS height, including any borders, padding, and horizontal scrollbars (if rendered). It does not include the height of pseudo-elements such as ::before or ::after
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetHeight
	 */
	height: number
	/**
	 * Number of pixels that the upper left corner of the current element is offset to the left within the HTMLElement.offsetParent node
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetLeft
	 */
	left: number
	/**
	 * Distance from the outer border of the current element (including its margin) to the top padding edge of the offsetParent, the closest positioned ancestor element.
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetTop
	 */
	top: number
	/**
	 * Layout width of an element as an integer.
	 *
	 * Typically, offsetWidth is a measurement in pixels of the element's CSS width, including any borders, padding, and vertical scrollbars (if rendered). It does not include the width of pseudo-elements such as ::before or ::after.
	 *
	 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth
	 */
	width: number
}

export type SetElementOffset = (node: HTMLElement | null) => void

/**
 * Listen to element layout changes.
 *
 * Pass the returned setter as a ref callback: `<div ref={updateElementOffset}>`.
 *
 * @param extraDeps Accessor returning a list of values that should re-trigger a measurement.
 *   Equivalent to React's `useElementOffset(extraDependencies)` — useful when the
 *   element re-renders children (payload, label) but the layout box of the parent
 *   must be re-read to compute a transform.
 */
export function useElementOffset(
	extraDeps?: () => readonly unknown[],
): [() => ElementOffset, SetElementOffset] {
	const [lastBoundingBox, setLastBoundingBox] = createSignal<ElementOffset>({
		height: 0,
		left: 0,
		top: 0,
		width: 0,
	})
	const [node, setNode] = createSignal<HTMLElement | null>(null)

	const measure = (target: HTMLElement) => {
		const rect = target.getBoundingClientRect()
		const current = untrack(lastBoundingBox)
		if (
			Math.abs(rect.height - current.height) > EPS ||
			Math.abs(rect.left - current.left) > EPS ||
			Math.abs(rect.top - current.top) > EPS ||
			Math.abs(rect.width - current.width) > EPS
		) {
			setLastBoundingBox({
				height: rect.height,
				left: rect.left,
				top: rect.top,
				width: rect.width,
			})
		}
	}

	/* Measure after the node attaches and whenever any tracked dep changes — mirrors
	   React's ref callback (called at commit, with children in place) and
	   useCallback([extraDependencies]), which forces a fresh ref callback. A Solid ref
	   fires before dynamic children are inserted, so the ref itself does not measure.
	   Without the deps the bounding box is read once at mount (often 0×0 for a hidden
	   tooltip) and never updates when payload/active flips. */
	createEffect(
		() => {
			extraDeps?.()
			return node()
		},
		(target) => {
			if (target != null) measure(target)
		},
	)

	/* ResizeObserver covers the case where children grow/shrink (formatter,
	   payload row count) without an explicit dep change. Guarded for SSR /
	   environments without RO support (e.g. very old jsdom). */
	createEffect(node, (target) => {
		if (target == null || typeof ResizeObserver === "undefined") return undefined
		const ro = new ResizeObserver(() => measure(target))
		ro.observe(target)
		return () => ro.disconnect()
	})

	const updateBoundingBox: SetElementOffset = (next) => {
		setNode(next)
	}

	return [lastBoundingBox, updateBoundingBox]
}
