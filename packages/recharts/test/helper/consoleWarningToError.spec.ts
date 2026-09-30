import { describe, it, expect, beforeEach } from "vitest"
import {
	setupConsoleWarningToError,
	IGNORE_WARNINGS,
	restoreConsole,
} from "./consoleWarningToError"

describe("consoleWarningToError", () => {
	beforeEach(() => {
		IGNORE_WARNINGS.length = 0
		restoreConsole()
		setupConsoleWarningToError()
	})
	it("should throw on console.warn if not in IGNORE list", () => {
		expect(() => {
			console.warn("This is a normal warning")
		}).toThrow("Console warning treated as test failure:" + " This is a normal warning")
	})
	it("should suppress warnings matching IGNORE_WARNINGS", () => {
		IGNORE_WARNINGS.push("ignore this")

		expect(() => {
			console.warn("Please ignore this warning")
		}).not.toThrow()
	})
	it("should allow RegExp patterns", () => {
		IGNORE_WARNINGS.push(/test \d+ pattern/)
		expect(() => {
			console.warn("This is test 123 pattern warning")
		}).not.toThrow()
	})
	it("should handle console.error similarly", () => {
		expect(() => {
			console.error("This matches error pattern")
		}).toThrow("Console error treated as test failure:" + " This matches error pattern")
	})
})
