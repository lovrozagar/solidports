import { describe, it, expect } from "vitest"
import {
	RadialCursorPoints,
	getRadialCursorPoints,
} from "../../../src/util/cursor/getRadialCursorPoints"
import { PolarCoordinate } from "../../../src/util/types"

describe("getRadialCursorPoints", () => {
	it("should add startPoint and endPoint to activeCoordinate", () => {
		const activeCoordinate: PolarCoordinate = {
			angle: 0,
			clockWise: false,
			cx: 10,
			cy: 15,
			endAngle: 60,
			innerRadius: 0,
			outerRadius: 0,
			radius: 5,
			startAngle: 30,
			x: 0,
			y: 0,
		}
		const result = getRadialCursorPoints(activeCoordinate)
		const expected: RadialCursorPoints = {
			cx: 10,
			cy: 15,
			endAngle: 60,
			points: [
				{ x: 14.330127018922195, y: 12.5 },
				{ x: 12.5, y: 10.669872981077807 },
			],
			radius: 5,
			startAngle: 30,
		}
		expect(result).toEqual(expected)
	})
})
