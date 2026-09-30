import { Series, SeriesPoint } from "victory-vendor/d3-shape"
import { getStackedData, offsetSign } from "../../../src/util/ChartUtils"
import { StackOffsetType } from "../../../src/util/types"

export function createSeries(
	key: string,
	index: number,
	data: Array<SeriesPoint<Record<string, unknown>>> = [],
): Series<Record<string, unknown>, string> {
	return Object.assign(data, { index, key })
}

export function createSeriesPoint(
	first: number,
	second: number,
	data: Record<string, unknown>,
): SeriesPoint<Record<string, unknown>> {
	return Object.assign([], { 0: first, 1: second, data })
}

const mockData = [
	{ amt: 1400, name: "Page A", pv: 800, uv: 590 },
	{ amt: 1506, name: "Page B", pv: 967, uv: 868 },
]

const dataWithNegativeNumbers = [
	{ amt: 2400, name: "Page A", pv: 2400, uv: 4000 },
	{ amt: 2210, name: "Page B", pv: 1398, uv: -3000 },
	{ amt: 2290, name: "Page C", pv: -9800, uv: -2000 },
	{ amt: 2000, name: "Page D", pv: 3908, uv: 2780 },
	{ amt: 2181, name: "Page E", pv: 4800, uv: -1890 },
	{ amt: 2500, name: "Page F", pv: -3800, uv: 2390 },
	{ amt: 2100, name: "Page G", pv: 4300, uv: 3490 },
]

/**
 * If you see one of these tests failing with a message "serializes to the same string",
 * that is because the d3-shape library assigns arbitrary property keys to an array.
 *
 * Jest doesn't like that. When it compares the two arrays it can see that it has extra property,
 * and if that extra property is different then it fails.
 * But when printing the array, it only prints the usual array elements, and ignores the extra properties.
 * Therefore, the "serializes to the same string" problem.
 *
 * So when you see that error, try to compare the other properties, like `Series.key` and `SeriesPoint.data`.
 * Or print them with console.log, that will show the difference.
 */
describe("getStackedData", () => {
	it("should return empty array if there is no data", () => {
		expect(getStackedData([], [], "none")).toEqual([])
	})
	it("should return empty array if there is some data but no data keys", () => {
		expect(getStackedData([{ x: 1 }], [], "none")).toEqual([])
	})
	it("should return one empty array for each dataKey even if it is not part of the data", () => {
		const result = getStackedData([], ["x", "y", "z"], "none")
		const expected = [createSeries("x", 0), createSeries("y", 1), createSeries("z", 2)]
		expect(result).toEqual(expected)
	})
	it("should return one empty array for each data key even if it is not part of the data", () => {
		const result = getStackedData([], ["x", "y", "z"], "none")
		const expected = [createSeries("x", 0), createSeries("y", 1), createSeries("z", 2)]
		expect(result).toEqual(expected)
	})

	const allOffsets: StackOffsetType[] = ["expand", "none", "positive", "sign", "silhouette", "wiggle"]
	describe.each(allOffsets)("with offset %s", (offset) => {
		it("should stack numerical data", () => {
			const dataKeys = ["uv", "pv"]
			const result = getStackedData(mockData, dataKeys, offset)
			expect(result).toHaveLength(dataKeys.length)
			result.forEach((series) => {
				expect(series).toHaveLength(mockData.length)
				series.forEach((point) => {
					expect(point[0]).toEqual(expect.any(Number))
					expect(point[1]).toEqual(expect.any(Number))
					expect(point[0]).not.toBeNaN()
					expect(point[1]).not.toBeNaN()
				})
			})
		})

		it("should stack data when dataKey is a function", () => {
			const dataKeys = [
				(o: Record<string, number>) => o.uv + 100,
				(o: Record<string, number>) => o.pv - 100,
			]
			const result = getStackedData(mockData, dataKeys, offset)
			expect(result).toHaveLength(dataKeys.length)
			result.forEach((series) => {
				expect(series).toHaveLength(mockData.length)
				series.forEach((point) => {
					expect(point[0]).toEqual(expect.any(Number))
					expect(point[1]).toEqual(expect.any(Number))
					expect(point[0]).not.toBeNaN()
					expect(point[1]).not.toBeNaN()
				})
			})
		})
	})

	it("should stack numerical data with offset: none", () => {
		const result = getStackedData(mockData, ["uv", "pv"], "none")
		const firstSeries = createSeries("uv", 0, [
			createSeriesPoint(0, 590, mockData[0]),
			createSeriesPoint(0, 868, mockData[1]),
		])
		const secondSeries = createSeries("pv", 1, [
			createSeriesPoint(590, 1390, mockData[0]),
			createSeriesPoint(868, 1835, mockData[1]),
		])
		const expected = [firstSeries, secondSeries]
		expect(result).toEqual(expected)
	})

	it("should stack numerical data with offset: sign", () => {
		const result = getStackedData(dataWithNegativeNumbers, ["uv", "pv"], "sign")
		const uvSeries = createSeries("uv", 0, [
			createSeriesPoint(0, 4000, dataWithNegativeNumbers[0]),
			createSeriesPoint(0, -3000, dataWithNegativeNumbers[1]),
			createSeriesPoint(0, -2000, dataWithNegativeNumbers[2]),
			createSeriesPoint(0, 2780, dataWithNegativeNumbers[3]),
			createSeriesPoint(0, -1890, dataWithNegativeNumbers[4]),
			createSeriesPoint(0, 2390, dataWithNegativeNumbers[5]),
			createSeriesPoint(0, 3490, dataWithNegativeNumbers[6]),
		])
		const pvSeries = createSeries("pv", 1, [
			createSeriesPoint(4000, 6400, dataWithNegativeNumbers[0]),
			createSeriesPoint(0, 1398, dataWithNegativeNumbers[1]),
			createSeriesPoint(-2000, -11800, dataWithNegativeNumbers[2]),
			createSeriesPoint(2780, 6688, dataWithNegativeNumbers[3]),
			createSeriesPoint(0, 4800, dataWithNegativeNumbers[4]),
			createSeriesPoint(0, -3800, dataWithNegativeNumbers[5]),
			createSeriesPoint(3490, 7790, dataWithNegativeNumbers[6]),
		])
		const expected = [uvSeries, pvSeries]
		expect(result).toEqual(expected)
	})

	it("with offset: positive should ignore all negative data points", () => {
		const dataKeys = ["uv", "pv"]
		const result = getStackedData(dataWithNegativeNumbers, dataKeys, "positive")
		const uvSeries = createSeries("uv", 0, [
			createSeriesPoint(0, 4000, dataWithNegativeNumbers[0]),
			createSeriesPoint(0, 0, dataWithNegativeNumbers[1]),
			createSeriesPoint(0, 0, dataWithNegativeNumbers[2]),
			createSeriesPoint(0, 2780, dataWithNegativeNumbers[3]),
			createSeriesPoint(0, 0, dataWithNegativeNumbers[4]),
			createSeriesPoint(0, 2390, dataWithNegativeNumbers[5]),
			createSeriesPoint(0, 3490, dataWithNegativeNumbers[6]),
		])
		const pvSeries = createSeries("pv", 1, [
			createSeriesPoint(4000, 6400, dataWithNegativeNumbers[0]),
			createSeriesPoint(0, 1398, dataWithNegativeNumbers[1]),
			createSeriesPoint(0, 0, dataWithNegativeNumbers[2]),
			createSeriesPoint(2780, 6688, dataWithNegativeNumbers[3]),
			createSeriesPoint(0, 4800, dataWithNegativeNumbers[4]),
			createSeriesPoint(0, 0, dataWithNegativeNumbers[5]),
			createSeriesPoint(3490, 7790, dataWithNegativeNumbers[6]),
		])
		const expected = [uvSeries, pvSeries]
		expect(result).toEqual(expected)
	})

	it("should stack data when dataKey is a function with offset: none", () => {
		const result = getStackedData(mockData, [(o) => o.uv + 100, (o) => o.pv - 100], "none")
		const firstSeries = createSeries("uv", 0, [
			createSeriesPoint(0, 690, mockData[0]),
			createSeriesPoint(0, 968, mockData[1]),
		])
		const secondSeries = createSeries("pv", 1, [
			createSeriesPoint(690, 1390, mockData[0]),
			createSeriesPoint(968, 1835, mockData[1]),
		])
		const expected = [firstSeries, secondSeries]
		/* Direct comparison with .toEqual rejects function `key` properties — compare per-point instead. */
		expect(result).toHaveLength(expected.length)
		expect(result[0]).toHaveLength(firstSeries.length)
		expect(result[1]).toHaveLength(secondSeries.length)
		result[0].forEach((point, index) => {
			expect(point).toEqual(firstSeries[index])
		})
		result[1].forEach((point, index) => {
			expect(point).toEqual(secondSeries[index])
		})
	})

	test("offset: positive should turn data that are not numbers to zero", () => {
		const mockCategoryData = [{ name: "x" }, { name: "y" }, { name: "z" }]
		const result = getStackedData(mockCategoryData, ["x"], "positive")
		const expected = [
			createSeries("x", 0, [
				createSeriesPoint(0, 0, mockCategoryData[0]),
				createSeriesPoint(0, 0, mockCategoryData[1]),
				createSeriesPoint(0, 0, mockCategoryData[2]),
			]),
		]
		expect(result).toEqual(expected)
	})

	test("offset: sign should turn data that are not numbers to zero", () => {
		const mockCategoryData = [
			{ name: "x" },
			{ name: "" },
			{ name: NaN },
			{
				name: function anon() {
					return 0
				},
			},
		]
		const result = getStackedData(mockCategoryData, ["x"], "sign")
		const expected = [
			createSeries("x", 0, [
				createSeriesPoint(0, 0, mockCategoryData[0]),
				createSeriesPoint(0, 0, mockCategoryData[1]),
				createSeriesPoint(0, 0, mockCategoryData[2]),
				createSeriesPoint(0, 0, mockCategoryData[3]),
			]),
		]
		expect(result).toEqual(expected)
	})

	test("offsetSign should mutate data in place", () => {
		const data = [
			createSeries("", 0, [
				createSeriesPoint(0, 1, {}),
				createSeriesPoint(0, 2, {}),
				createSeriesPoint(0, -5, {}),
			]),
			createSeries("", 1, [
				createSeriesPoint(0, -1, {}),
				createSeriesPoint(0, 2, {}),
				createSeriesPoint(0, -5, {}),
			]),
		]
		const expected = [
			createSeries("", 0, [
				createSeriesPoint(0, 1, {}),
				createSeriesPoint(0, 2, {}),
				createSeriesPoint(0, -5, {}),
			]),
			createSeries("", 1, [
				createSeriesPoint(0, -1, {}),
				createSeriesPoint(2, 4, {}),
				createSeriesPoint(-5, -10, {}),
			]),
		]
		offsetSign(data, [])
		expect(data).toEqual(expected)
	})

	test("stacking numbers encoded as strings produces numbers", () => {
		const data = [
			{ name: "A", pv: "2", uv: "1" },
			{ name: "B", pv: "4", uv: "3" },
		]
		const result = getStackedData(data, ["uv", "pv"], "none")
		const expected = [
			createSeries("uv", 0, [
				createSeriesPoint(0, 1, data[0]),
				createSeriesPoint(0, 3, data[1]),
			]),
			createSeries("pv", 1, [
				createSeriesPoint(1, 3, data[0]),
				createSeriesPoint(3, 7, data[1]),
			]),
		]
		expect(result).toEqual(expected)
	})

	test("stacking strings that are not numbers produces NaN - this is a bug if you ask me, we should reject non-numerical data", () => {
		const data = [
			{ name: "A", pv: "b", uv: "a" },
			{ name: "B", pv: "d", uv: "c" },
		]
		const result = getStackedData(data, ["uv", "pv"], "none")
		const expected = [
			createSeries("uv", 0, [
				createSeriesPoint(0, NaN, data[0]),
				createSeriesPoint(0, NaN, data[1]),
			]),
			createSeries("pv", 1, [
				createSeriesPoint(0, NaN, data[0]),
				createSeriesPoint(0, NaN, data[1]),
			]),
		]
		expect(result).toEqual(expected)
	})

	it("should stack ranged data", () => {
		const displayedData = [
			{ key1: [100, 200], key2: [150, 250], key3: [200, 300] },
			{ key1: [120, 180], key2: [130, 230], key3: [170, 270] },
			{ key1: [90, 160], key2: [110, 210], key3: [140, 240] },
			{ key1: [80, 140], key2: [100, 200], key3: [130, 220] },
		]
		const result = getStackedData(displayedData, ["key1", "key2", "key3"], "none")
		const firstSeries = createSeries("key1", 0, [
			createSeriesPoint(100, 200, displayedData[0]),
			createSeriesPoint(120, 180, displayedData[1]),
			createSeriesPoint(90, 160, displayedData[2]),
			createSeriesPoint(80, 140, displayedData[3]),
		])
		const secondSeries = createSeries("key2", 1, [
			createSeriesPoint(150, 250, displayedData[0]),
			createSeriesPoint(130, 230, displayedData[1]),
			createSeriesPoint(110, 210, displayedData[2]),
			createSeriesPoint(100, 200, displayedData[3]),
		])
		const thirdSeries = createSeries("key3", 2, [
			createSeriesPoint(200, 300, displayedData[0]),
			createSeriesPoint(170, 270, displayedData[1]),
			createSeriesPoint(140, 240, displayedData[2]),
			createSeriesPoint(130, 220, displayedData[3]),
		])
		const expected = [firstSeries, secondSeries, thirdSeries]
		expect(result).toEqual(expected)
	})
})
