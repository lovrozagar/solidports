import { flush } from "solid-js"
import { assertNotNull } from "./assertNotNull"

export function focusTestHelper(
	container: HTMLElement | SVGElement,
	selector: string,
	debug?: () => void,
): HTMLElement | SVGElement {
	const element = container.querySelector(selector)
	if (element == null && debug != null) {
		debug()
	}
	assertNotNull(element)
	if (element instanceof HTMLElement || element instanceof SVGElement) {
		element.focus()
		/* Direct DOM focus bypasses testing-library's event wrapper. */
		flush()
		return element
	}
	throw new Error(`Expected instance of HTMLElement or SVGElement, instead got: ${element}`)
}
