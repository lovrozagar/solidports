/* eslint-disable import/no-cycle */
import { getPercentValue, isNullish } from "../../../util/DataUtils"
import { BarWithPosition, SizeList } from "../barSelectors"
import { isWellBehavedNumber } from "../../../util/isWellBehavedNumber"
import { BarPositionPosition } from "../../../util/ChartUtils"
import { BarCategory } from "./combineBarSizeList"

function getBarPositions(
	barGap: string | number,
	barCategoryGap: string | number,
	bandSize: number,
	sizeList: SizeList,
	maxBarSize: number | undefined,
): ReadonlyArray<BarWithPosition> | undefined {
	const len = sizeList.length
	if (len < 1) {
		return undefined
	}

	let realBarGap = getPercentValue(barGap, bandSize, 0, true)

	let result: Array<BarWithPosition>

	if (isWellBehavedNumber(sizeList[0]?.barSize)) {
		let useFull = false
		let fullBarSize: number = bandSize / len
		let sum = sizeList.reduce((res, entry) => res + (entry.barSize || 0), 0)
		sum += (len - 1) * realBarGap

		if (sum >= bandSize) {
			sum -= (len - 1) * realBarGap
			realBarGap = 0
		}
		if (sum >= bandSize && fullBarSize > 0) {
			useFull = true
			fullBarSize *= 0.9
			sum = len * fullBarSize
		}

		const offset = ((bandSize - sum) / 2) >> 0
		let prev: BarPositionPosition = { offset: offset - realBarGap, size: 0 }

		result = sizeList.reduce(
			(res: Array<BarWithPosition>, entry: BarCategory): Array<BarWithPosition> => {
				const newPosition: BarWithPosition = {
					dataKeys: entry.dataKeys,
					position: {
						offset: prev.offset + prev.size + realBarGap,
						size: useFull ? fullBarSize : (entry.barSize ?? 0),
					},
					stackId: entry.stackId,
				}
				res.push(newPosition)
				prev = newPosition.position
				return res
			},
			[],
		)
	} else {
		const offset = getPercentValue(barCategoryGap, bandSize, 0, true)

		if (bandSize - 2 * offset - (len - 1) * realBarGap <= 0) {
			realBarGap = 0
		}

		let originalSize = (bandSize - 2 * offset - (len - 1) * realBarGap) / len
		if (originalSize > 1) {
			originalSize >>= 0
		}
		const size = isWellBehavedNumber(maxBarSize) ? Math.min(originalSize, maxBarSize) : originalSize
		result = sizeList.reduce(
			(res: Array<BarWithPosition>, entry: BarCategory, i): Array<BarWithPosition> => {
				res.push({
					dataKeys: entry.dataKeys,
					position: {
						offset: offset + (originalSize + realBarGap) * i + (originalSize - size) / 2,
						size,
					},
					stackId: entry.stackId,
				})
				return res
			},
			[],
		)
	}

	return result
}

export const combineAllBarPositions = (
	sizeList: SizeList,
	globalMaxBarSize: number | undefined,
	barGap: string | number,
	barCategoryGap: string | number,
	barBandSize: number,
	bandSize: number | undefined,
	childMaxBarSize: number | undefined,
): ReadonlyArray<BarWithPosition> | undefined => {
	const maxBarSize: number | undefined = isNullish(childMaxBarSize)
		? globalMaxBarSize
		: childMaxBarSize

	let allBarPositions: ReadonlyArray<BarWithPosition> | undefined = getBarPositions(
		barGap,
		barCategoryGap,
		barBandSize !== bandSize ? barBandSize : bandSize,
		sizeList,
		maxBarSize,
	)

	if (barBandSize !== bandSize && allBarPositions != null) {
		allBarPositions = allBarPositions.map((pos) => ({
			...pos,
			position: { ...pos.position, offset: pos.position.offset - barBandSize / 2 },
		}))
	}

	return allBarPositions
}
