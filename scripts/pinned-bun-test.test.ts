import { describe, expect, test } from "bun:test"
import { pinnedBun, pinnedRun, suiteEnv } from "./pinned-bun-test"

describe("scripts suite under the pinned Bun", () => {
	test("reads the version packageManager pins", () => {
		expect(pinnedBun("bun@1.3.11")).toBe("1.3.11")
		expect(pinnedBun("pnpm@9.0.0")).toBeUndefined()
		expect(pinnedBun(undefined)).toBeUndefined()
	})

	test("reruns the suite under the pin only when the local Bun differs", () => {
		// CI runs the pin: under Bun 1.3.11 a timer fired early where 1.4.3's did not, and the
		// scripts suite failed in CI only.
		expect(pinnedRun("bun@1.3.11", "1.4.3")).toEqual(["bunx", "bun@1.3.11", "test", "./scripts"])
		expect(pinnedRun("bun@1.3.11", "1.3.11")).toBeNull()
		expect(pinnedRun(undefined, "1.4.3")).toBeNull()
	})

	test("runs the suite without git's hook variables", () => {
		// Under pre-push, git sets GIT_DIR and friends; the suite's temporary repos would follow them.
		expect(suiteEnv({ GIT_DIR: ".git", GIT_INDEX_FILE: "x", PATH: "/bin", HOME: "/h" })).toEqual({
			PATH: "/bin",
			HOME: "/h",
		})
	})
})
