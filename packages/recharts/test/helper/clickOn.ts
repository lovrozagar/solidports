import { fireEvent } from "@solidjs/testing-library"
import { assertNotNull } from "./assertNotNull"

export function clickOn(selector: string): (container: HTMLElement) => void {
	return function clickOnElement(container: HTMLElement): void {
		assertNotNull(container)
		const target = container.querySelector(selector)
		assertNotNull(target)
		fireEvent.click(target)
	}
}
