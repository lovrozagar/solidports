import { describe, expect, test } from "bun:test"
import { ALLOWANCES, splitAllowed, validateAllowances } from "../packages/base-ui/test/perf-solid/shared/allowances.mjs"

const verdict = (key: string, metric: string, delta: number) => ({
	key,
	metric,
	delta,
	base: 1100,
	cur: 1100 + delta,
	ci: [delta, delta] as [number, number],
	minEffect: 1,
	p: 0.001,
	verdict: "regressed" as const,
})

describe("reviewed gate allowances", () => {
	test("every allowance names its decision, its reason, its bound and when it lapses", () => {
		expect(validateAllowances(ALLOWANCES)).toEqual([])
	})

	test("an allowance without an expiry, or whose decision the log does not hold, is rejected", () => {
		const [entry] = ALLOWANCES
		expect(validateAllowances([{ ...entry, until: undefined as never }])).toEqual([
			`${entry.key} ${entry.metric}: \`until\` must name a plan leaf (5.3) or a decision (D23)`,
		])
		expect(validateAllowances([{ ...entry, decision: "D999" }])).toEqual([
			`${entry.key} ${entry.metric}: decision D999 is not in the decision log`,
		])
	})

	test("a regression on an allowed row within its bound is allowed, with its decision", () => {
		const { allowed, failing } = splitAllowed(
			[verdict("toggle-group/300-single › heap after mount KB", "heapKB", 42.3)],
			() => 1895.5,
		)
		expect(failing).toEqual([])
		expect(allowed.map((entry) => entry.allowance.decision)).toEqual(["D23"])
	})

	test("a regression past the bound, or on a row or metric not allowed, fails", () => {
		const { allowed, failing } = splitAllowed(
			[
				verdict("toggle-group/300-single › heap after mount KB", "heapKB", 120),
				verdict("toggle-group/300-single › controlled value", "script", 0.2),
				verdict("toggle-group/300-single › heap after mount KB", "retainedKB", 10),
			],
			() => 1895.5,
		)
		expect(allowed).toEqual([])
		expect(failing.map((entry) => `${entry.key} ${entry.metric}`)).toEqual([
			"toggle-group/300-single › heap after mount KB heapKB",
			"toggle-group/300-single › controlled value script",
			"toggle-group/300-single › heap after mount KB retainedKB",
		])
	})

	test("an allowed row within its bound fails once it reaches React, or when React was not measured", () => {
		const row = [verdict("toggle-group/300-single › heap after mount KB", "heapKB", 42.3)]
		expect(splitAllowed(row, () => 1100).failing).toHaveLength(1)
		expect(splitAllowed(row, () => undefined).failing).toHaveLength(1)
	})

	// D24: a row already above React at the base (menu/500 open by keyboard, 1.94x at 3eef0aca) may
	// take its bounded shift; the mode applies only when the base is above React in the session.
	describe("an entry for a row above React at the base", () => {
		const menu = "menu/500 › open by keyboard"
		const at = (base: number, delta: number) => ({ ...verdict(menu, "sync", delta), base, cur: base + delta })

		test("is allowed within its bound while the base is above React", () => {
			const { allowed, failing } = splitAllowed([at(22.1, 1.6)], () => 11.4)
			expect(failing).toEqual([])
			expect(allowed.map((entry) => entry.allowance.decision)).toEqual(["D24"])
		})

		test("fails beyond its bound", () => {
			expect(splitAllowed([at(22.1, 3)], () => 11.4).failing).toHaveLength(1)
		})

		test("takes the below-React rule when the base is below React", () => {
			expect(splitAllowed([at(20, 1.6)], () => 21).failing).toHaveLength(1)
			expect(splitAllowed([at(20, 1.6)], () => 30).allowed).toHaveLength(1)
		})

		test("fails when React was not measured", () => {
			expect(splitAllowed([at(22.1, 1.6)], () => undefined).failing).toHaveLength(1)
		})
	})

	test("an entry not marked for a base above React fails above React", () => {
		const row = { ...verdict("preview-card/roots-200 › move across 20", "sync", 1.8), base: 25.1, cur: 26.9 }
		expect(splitAllowed([row], () => 31.5).allowed).toHaveLength(1)
		expect(splitAllowed([row], () => 20).failing).toHaveLength(1)
	})
})
