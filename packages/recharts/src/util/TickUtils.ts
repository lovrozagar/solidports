/* eslint-disable import/no-cycle */
import { getAngledRectangleWidth } from "./CartesianUtils"
import { getEveryNth } from "./getEveryNth"
import { Size, CartesianTickItem, CartesianViewBoxRequired } from "./types"

export function getAngledTickWidth(contentSize: Size, unitSize: Size, angle: number | undefined) {
	const size = {
		height: contentSize.height + unitSize.height,
		width: contentSize.width + unitSize.width,
	}

	return getAngledRectangleWidth(size, angle)
}

export function getTickBoundaries(
	viewBox: CartesianViewBoxRequired,
	sign: number,
	sizeKey: string,
) {
	const isWidth = sizeKey === "width"
	const { x, y, width, height } = viewBox
	if (sign === 1) {
		return {
			end: isWidth ? x + width : y + height,
			start: isWidth ? x : y,
		}
	}
	return {
		end: isWidth ? x : y,
		start: isWidth ? x + width : y + height,
	}
}

export function isVisible(
	sign: number,
	tickPosition: number,
	getSize: () => number,
	start: number,
	end: number,
): boolean {
	/* Since getSize() is expensive (it reads the ticks' size from the DOM), we do this check first to avoid calculating
	 * the tick's size. */
	if (sign * tickPosition < sign * start || sign * tickPosition > sign * end) {
		return false
	}

	const size = getSize()

	return (
		sign * (tickPosition - (sign * size) / 2 - start) >= 0 &&
		sign * (tickPosition + (sign * size) / 2 - end) <= 0
	)
}

export function getNumberIntervalTicks(
	ticks: ReadonlyArray<CartesianTickItem>,
	interval: number,
): ReadonlyArray<CartesianTickItem> | undefined {
	return getEveryNth(ticks, interval + 1)
}
