import { TooltipIndex } from "../../src/state/tooltipSlice"
import {
	DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME,
	DATA_ITEM_INDEX_ATTRIBUTE_NAME,
} from "../../src/util/Constants"
import { GraphicalItemId } from "../../src/state/graphicalItemsSlice"

/**
 * Pretends user is touching an element at the given index.
 * Useful for testing, simulating touch events without
 * actually touching the screen.
 *
 * jsdom does not support elementFromPoint because it
 * doesn't support layouting.
 * See https://github.com/jsdom/jsdom/issues/1435
 * @param touchItemIndex the index of the item being touched
 * @param graphicalItemId the graphical item id being touched
 * @returns void
 */
export function mockTouchingElement(
	touchItemIndex: NonNullable<TooltipIndex>,
	graphicalItemId: GraphicalItemId,
): void {
	const fakeElement = document.createElement("g")
	fakeElement.setAttribute(DATA_ITEM_INDEX_ATTRIBUTE_NAME, touchItemIndex)
	fakeElement.setAttribute(DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME, graphicalItemId)
	document.elementFromPoint = () => fakeElement
}

/**
 * Mocks user touching some element that is not
 * any of the chart elements.
 * @return void
 */
export function mockTouchingUnrelatedElement(): void {
	const fakeElement = document.createElement("g")
	document.elementFromPoint = () => fakeElement
}
