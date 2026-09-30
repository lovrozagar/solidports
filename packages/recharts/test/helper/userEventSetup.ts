import userEvent from "@testing-library/user-event"

/**
 * user-event setup with mocked timers awareness.
 *
 * See:
 * https://testing-library.com/docs/user-event/options/#advancetimers
 */
export function userEventSetup() {
	return userEvent.setup({
		advanceTimers: vi.advanceTimersByTime,
	})
}
