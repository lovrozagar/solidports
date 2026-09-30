import { Mock, expect } from "vitest"
import { AxisDomain } from "../../src/util/types"

import { RechartsScale } from "../../src/util/scale/RechartsScale"
import { assertNotNull } from "./assertNotNull"

export type ExpectedScale = {
	bandwidth?: number
	domain: AxisDomain
	range: [number, number]
}

/**
 * Good for comparing when you have a direct reference
 * to the scale function.
 *
 * Note that the `actual` is meant to be a function with
 * `domain` and `range` properties, which are also functions.
 * The `expected` however is a result of calling the `domain`
 * and `range` functions, which makes it easier to assert.
 *
 * @param actual object that you want to check
 * @param expected expected domain and range
 * @throws if the actual does not match the expected
 * @returns void
 */
export function expectScale(actual: unknown, expected: ExpectedScale) {
	assertNotNull(actual)
	const scale = actual as RechartsScale
	expect(scale.map).toBeInstanceOf(Function)
	expect(scale.domain(), "domain error").toEqual(expected.domain)
	expect(scale.range(), "range error").toEqual(expected.range)
	if ("bandwidth" in expected && typeof scale.bandwidth === "function") {
		expect(scale.bandwidth(), "bandwidth error").toEqual(expected.bandwidth)
	}
}

/**
 * Good for comparing when you have a spy that returns the
 * scale function but you don't want to remember how to pull
 * the reference from the mock calls.
 *
 * Verifies the last call to the spy was with the expected
 * scale.
 *
 * @param spy function created by vi.fn()
 * @param expected expected domain and range
 * @throws if the last call was not with the expected scale
 * @returns void
 */
export function expectLastCalledWithScale(
	spy: Mock<(scale: RechartsScale) => unknown>,
	expected: ExpectedScale,
) {
	expect(spy).toHaveBeenCalled()
	const lastKnownScale = spy.mock.calls[spy.mock.calls.length - 1][0]
	expectScale(lastKnownScale, expected)
}
