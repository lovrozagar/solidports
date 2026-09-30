import { Mock } from "vitest"

/**
 * Same as `expect(spy).toHaveBeenLastCalledWith(expected)`
 * but with correct typescript types.
 * @param spy vi.fn()
 * @param expected1 the first expected argument
 * @param expected2 second expected argument (optional)
 * @param expected3 third expected argument (optional)
 * @param expected4 fourth expected argument (optional)
 * @throws if spy was not called with the expected argument
 * @return void
 */
export function expectLastCalledWith<T1, T2, T3, T4>(
	spy: Mock<(arg1: T1, arg2: T2, arg3: T3, arg4: T4) => void>,
	expected1: T1,
	expected2?: T2,
	expected3?: T3,
	expected4?: T4,
): void {
	if (expected4 !== undefined) {
		expect(spy).toHaveBeenLastCalledWith(expected1, expected2, expected3, expected4)
		return
	}
	if (expected3 !== undefined) {
		expect(spy).toHaveBeenLastCalledWith(expected1, expected2, expected3)
		return
	}
	if (expected2 !== undefined) {
		expect(spy).toHaveBeenLastCalledWith(expected1, expected2)
		return
	}
	expect(spy).toHaveBeenLastCalledWith(expected1)
}

/**
 * Same as `expect(spy).toHaveBeenNthCalledWith(N, expected)`
 * but with correct typescript types.
 * @param spy vi.fn()
 * @param n the call number (1-based)
 * @param expected1 the expected argument
 * @param expected2 second expected argument
 * @throws if spy was not called with the expected argument
 * @return void
 */
export function expectNthCalledWith<T1, T2>(
	spy: Mock<(arg1: T1, arg2: T2) => void>,
	n: number,
	expected1: T1,
	expected2?: T2,
): void {
	if (expected2 !== undefined) {
		expect(spy).toHaveBeenNthCalledWith(n, expected1, expected2)
		return
	}
	expect(spy).toHaveBeenNthCalledWith(n, expected1)
}
