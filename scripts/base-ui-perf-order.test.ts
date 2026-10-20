import { describe, expect, test } from "bun:test"
import { balancedOrders, splitRuns } from "../packages/base-ui/test/perf-solid/shared/order.mjs"

const names = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`)

describe("balanced variant orders", () => {
	for (const n of [1, 2, 3, 4, 5]) {
		test(`${n} variants: every variant holds every position equally often`, () => {
			const orders = balancedOrders(names(n))
			for (const order of orders) expect([...order].sort()).toEqual(names(n))
			const counts = new Map<string, number>()
			for (const order of orders)
				order.forEach((name, position) =>
					counts.set(`${name}@${position}`, (counts.get(`${name}@${position}`) ?? 0) + 1),
				)
			expect(new Set(counts.values()).size).toBe(1)
			expect(counts.size).toBe(n * n)
		})

		test(`${n} variants: every variant follows every other one equally often`, () => {
			const orders = balancedOrders(names(n))
			const follows = new Map<string, number>()
			for (const order of orders)
				for (let i = 1; i < order.length; i += 1)
					follows.set(`${order[i - 1]}>${order[i]}`, (follows.get(`${order[i - 1]}>${order[i]}`) ?? 0) + 1)
			expect(follows.size).toBe(n * (n - 1))
			if (n > 1) expect(new Set(follows.values()).size).toBe(1)
		})
	}

	test("two variants alternate: AB, BA", () => {
		expect(balancedOrders(["a", "b"])).toEqual([
			["a", "b"],
			["b", "a"],
		])
	})

	test("the first order is the given one, so a run of one round keeps it", () => {
		expect(balancedOrders(names(3))[0]).toEqual(names(3))
		expect(balancedOrders(names(4))[0]).toEqual(names(4))
	})
})

describe("runs split over rounds", () => {
	test("two variants keep two rounds of the given runs", () => {
		expect(splitRuns(8, 2)).toEqual([8, 8])
	})

	test("three variants (React, base, cur) keep every variant's sample count across six rounds", () => {
		for (const runs of [1, 3, 8, 12, 20]) {
			const split = splitRuns(runs, balancedOrders(names(3)).length)
			expect(split.length).toBe(6)
			expect(split.reduce((a, b) => a + b, 0)).toBe(2 * runs)
			expect(Math.max(...split) - Math.min(...split)).toBeLessThanOrEqual(1)
		}
	})

	test("four variants keep their sample count across four rounds", () => {
		expect(splitRuns(8, balancedOrders(names(4)).length)).toEqual([4, 4, 4, 4])
	})
})
