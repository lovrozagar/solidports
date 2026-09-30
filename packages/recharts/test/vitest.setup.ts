import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"
import { restoreHTMLElementProperties } from "./helper/mockHTMLElementProperty"
import { setupConsoleWarningToError } from "./helper/consoleWarningToError"

process.env.TZ = "UTC"

setupConsoleWarningToError()

/**
 * Solid doesn't need fake timers for Redux batching like React did,
 * but many tests rely on timer control for animations and async behavior.
 */
vi.useFakeTimers()

/**
 * testing-library user-event expects a `jest` global for timer advancement.
 * Provide a shim for vitest compatibility.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
;(globalThis as any).jest = {
	advanceTimersByTime: vi.advanceTimersByTime,
}

afterEach(() => {
	restoreHTMLElementProperties()
})
