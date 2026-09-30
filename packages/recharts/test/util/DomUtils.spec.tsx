import { render } from "@solidjs/testing-library"
import {
	clearStringCache,
	configureTextMeasurement,
	getStringCacheStats,
	getStringSize,
	getTextMeasurementConfig,
} from "../../src/util/DOMUtils"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"

describe("DOMUtils", () => {
	beforeEach(() => {
		configureTextMeasurement({
			cacheSize: 2000,
			enableCache: true,
		})
		clearStringCache()
	})
	test("getStringSize() returns 0", () => {
		expect(getStringSize(undefined as never)).toEqual({ height: 0, width: 0 })
	})
	test("getStringSize() with value returns mocked getBoundingClientRect values", () => {
		render(() => <span id="recharts_measurement_span">test</span>)
		mockGetBoundingClientRect({
			bottom: 10,
			height: 17,
			left: 10,
			right: 10,
			top: 10,
			width: 25,
			x: 200,
			y: 100,
		})

		expect(getStringSize("test")).toEqual({
			height: 17,
			width: 25,
		})
	})
	test("cache should store and retrieve values correctly", () => {
		render(() => <span id="recharts_measurement_span">test</span>)
		mockGetBoundingClientRect({
			height: 17,
			width: 25,
		})

		const result1 = getStringSize("test", { "font-size": "14px" })
		expect(result1).toEqual({ height: 17, width: 25 })
		expect(getStringCacheStats().size).toBe(1)

		const result2 = getStringSize("test", { "font-size": "14px" })
		expect(result2).toEqual({ height: 17, width: 25 })
		expect(getStringCacheStats().size).toBe(1)
	})
	test("clearStringCache should clear the cache", () => {
		render(() => <span id="recharts_measurement_span">test</span>)
		mockGetBoundingClientRect({
			height: 17,
			width: 25,
		})

		getStringSize("test")
		expect(getStringCacheStats().size).toBe(1)

		clearStringCache()
		expect(getStringCacheStats().size).toBe(0)
	})
	test("cache should handle different styles separately", () => {
		render(() => <span id="recharts_measurement_span">test</span>)
		mockGetBoundingClientRect({
			height: 17,
			width: 25,
		})

		getStringSize("test", { "font-size": "14px" })
		getStringSize("test", { "font-size": "16px" })

		expect(getStringCacheStats().size).toBe(2)
	})
	test("configureTextMeasurement should update configuration", () => {
		const newConfig = {
			cacheSize: 1000,
			enableCache: false,
		}

		configureTextMeasurement(newConfig)
		const config = getTextMeasurementConfig()

		expect(config.cacheSize).toBe(1000)
		expect(config.enableCache).toBe(false)
	})
	test("should not cache when caching is disabled", () => {
		configureTextMeasurement({ enableCache: false })

		render(() => <span id="recharts_measurement_span">test</span>)
		mockGetBoundingClientRect({
			height: 17,
			width: 25,
		})

		getStringSize("test")
		getStringSize("test")

		expect(getStringCacheStats().size).toBe(0)
	})
})
