import { expect } from "vitest"
import { ExpectedScale, expectScale } from "./expectScale"

import { RechartsScale } from "../../src/util/scale/RechartsScale"

function rechartsScaleMatcher(
	received: unknown,
	expected: ExpectedScale,
): { message: () => string; pass: boolean } {
	try {
		expectScale(received, expected)
		return {
			message: () => "Expected scale to not be a scale function",
			pass: true,
		}
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e)
		return {
			message: () => errorMessage,
			pass: false,
		}
	}
}

expect.extend({
	toBeRechartsScale: rechartsScaleMatcher,
})

interface CustomMatchers {
	/**
	 * This matcher will check that the received object is a
	 * Recharts scale object with the expected domain and range.
	 *
	 * If you arrived here because you see a cryptic error
	 * failure message, you are in the right place.
	 *
	 * Place a debugger on the catch line above to see the
	 * actual error message, like:
	 * "domain error: expected [0, 1000] to equal [0, 2000]"
	 *
	 * @param expectedScale expected domain and range
	 */
	toBeRechartsScale: (expectedScale: ExpectedScale) => RechartsScale
}

declare module "vitest" {
	interface AsymmetricMatchersContaining extends CustomMatchers {}
}
