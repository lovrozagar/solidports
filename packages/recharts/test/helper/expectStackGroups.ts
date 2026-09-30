import { expect } from "vitest"
import { StackDataPoint, StackSeries } from "../../src/util/stacks/stackTypes"
import { MaybeStackedGraphicalItem } from "../../src/state/types/StackedGraphicalItem"

interface SyncExpectationResult {
	actual?: unknown
	expected?: unknown
	message: () => string
	pass: boolean
}

export type ExpectedStackedDataSeries = ReadonlyArray<StackDataPoint>

/*
 * Almost the same type as StackData, but with the data
 * being just an array of arrays of objects instead of
 * a d3-stack object.
 */
export type ExpectedStackedData = ReadonlyArray<ExpectedStackedDataSeries>

function seriesPointToTuple(seriesPoint: StackDataPoint): StackDataPoint {
	return [seriesPoint[0], seriesPoint[1]]
}

const actualSeriesToExpectedSeries = (
	s: ReadonlyArray<StackDataPoint>,
): ExpectedStackedDataSeries => {
	const array: Array<StackDataPoint> = []
	s.forEach((item) => {
		array.push(seriesPointToTuple(item))
	})
	return array
}

function seriesToArray(series: ReadonlyArray<ReadonlyArray<StackDataPoint>>): ExpectedStackedData {
	return series.map(actualSeriesToExpectedSeries)
}

/**
 * Comparing stack data for equality.
 * d3-stack adds static properties to arrays which makes
 * jest/vitest produce confusing output when using toEqual.
 * This compares arrays as plain arrays, ignoring static props.
 *
 * @param received the received value
 * @param expected the expected value
 * @throws Error if received is not an array or doesn't match
 * @returns void
 */
export function expectStackedData(
	received: ExpectedStackedData,
	expected: ExpectedStackedData,
): void {
	if (Array.isArray(received) === false) {
		throw new Error(`stackedData error: expected ${received} to be an array`)
	}
	expect(seriesToArray(received)).toEqual(expected)
}

export function expectStackedSeries(
	received: ExpectedStackedDataSeries,
	expected: ExpectedStackedDataSeries,
): void {
	if (Array.isArray(received) === false) {
		throw new Error(`stackedSeries error: expected ${received} to be an array`)
	}
	expect(actualSeriesToExpectedSeries(received)).toEqual(expected)
}

function rechartsStackedDataMatcher(
	received: ExpectedStackedData,
	expected: ExpectedStackedData,
): SyncExpectationResult {
	try {
		expectStackedData(received, expected)
		return {
			message: () => "Expected stack groups to not match",
			pass: true,
		}
	} catch (e) {
		return {
			message: () => (e instanceof Error ? e.message : String(e)),
			pass: false,
		}
	}
}

function rechartsStackedSeriesMatcher(
	received: ExpectedStackedDataSeries,
	expected: ExpectedStackedDataSeries,
): SyncExpectationResult {
	try {
		expectStackedSeries(received, expected)
		return {
			message: () => "Expected stack series to not match",
			pass: true,
		}
	} catch (e) {
		return {
			message: () => (e instanceof Error ? e.message : String(e)),
			pass: false,
		}
	}
}

function rechartsStackedSeriesPointMatcher(
	received: StackDataPoint,
	expected: StackDataPoint,
): SyncExpectationResult {
	try {
		if (Array.isArray(received) === false) {
			throw new Error(`stackedSeriesPoint error: expected ${received}` + " to be an array")
		}
		expect(seriesPointToTuple(received)).toEqual(expected)
		return {
			message: () => "Expected stack series point to not match",
			pass: true,
		}
	} catch (e) {
		return {
			message: () => (e instanceof Error ? e.message : String(e)),
			pass: false,
		}
	}
}

expect.extend({
	toBeRechartsStackedData: rechartsStackedDataMatcher,
	toBeRechartsStackedSeries: rechartsStackedSeriesMatcher,
	toBeRechartsStackedSeriesPoint: rechartsStackedSeriesPointMatcher,
})

interface CustomMatchers {
	/**
	 * Checks that received is a Recharts stacked data object
	 * with the expected data.
	 *
	 * @param expectedStackedData expected stacked data
	 */
	toBeRechartsStackedData: (expectedStackedData: ExpectedStackedData) => ReadonlyArray<StackSeries>
	toBeRechartsStackedSeries: (expectedStackedSeries: ExpectedStackedDataSeries) => StackSeries
	toBeRechartsStackedSeriesPoint: (expectedStackedSeriesPoint: StackDataPoint) => StackDataPoint
}

declare module "vitest" {
	interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/**
 * Vitest helpers are typed to return `any` which disables
 * type checking. This wraps with proper types.
 * @param expected the expected settings for the graphical item
 * @return expected settings wrapped in objectContaining matcher
 */
export function expectGraphicalItemSettings(
	expected: MaybeStackedGraphicalItem,
): MaybeStackedGraphicalItem {
	return expect.objectContaining(expected)
}
