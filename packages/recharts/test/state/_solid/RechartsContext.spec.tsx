/* @jsxImportSource @solidjs/web */
import { describe, expect, it } from "vitest"
import { flush } from "solid-js"
import { render, fireEvent } from "../../helper/render"
import type { JSX } from '@solidjs/web';
import { useChartState } from "../../../src/state/useChartState"
import { RechartsStateProvider } from "../../../src/state/RechartsStateProvider"

/* Renders state.chartSize.width as text. */
const WidthReader = (): JSX.Element => {
	const { state } = useChartState()
	return <span>{state.chartSize.width}</span>
}

describe("RechartsStateProvider / useChartState unit tests", () => {
	it("provides state to descendants — read returns initial state", () => {
		const { container } = render(() => (
			<RechartsStateProvider>
				<WidthReader />
			</RechartsStateProvider>
		))
		expect(container.textContent).toBe("0")
	})

	it("setState mutates state — descendants see new value", () => {
		const Control = (): JSX.Element => {
			const { setState } = useChartState()
			return <button onClick={() => setState("chartSize", "width", 400)}>set</button>
		}

		const { container, getByRole } = render(() => (
			<RechartsStateProvider>
				<WidthReader />
				<Control />
			</RechartsStateProvider>
		))

		expect(container.querySelector("span")?.textContent).toBe("0")
		fireEvent.click(getByRole("button"))
		expect(container.querySelector("span")?.textContent).toBe("400")
	})

	it("throws when useChartState is called outside provider", () => {
		expect(() => render(() => <WidthReader />)).toThrow(
			/@solidports\/recharts: useChartState called outside/,
		)
	})

	it("each provider instance owns its own state", () => {
		let setA: ReturnType<typeof useChartState>["setState"] | undefined

		const CaptureA = (): JSX.Element => {
			const ctx = useChartState()
			setA = ctx.setState
			return <span id="a">{ctx.state.chartSize.width}</span>
		}

		const ReaderB = (): JSX.Element => {
			const { state } = useChartState()
			return <span id="b">{state.chartSize.width}</span>
		}

		const { container } = render(() => (
			<>
				<RechartsStateProvider>
					<CaptureA />
				</RechartsStateProvider>
				<RechartsStateProvider>
					<ReaderB />
				</RechartsStateProvider>
			</>
		))

		expect(container.querySelector("#a")?.textContent).toBe("0")
		expect(container.querySelector("#b")?.textContent).toBe("0")

		setA!("chartSize", "width", 999)

		flush()

		expect(container.querySelector("#a")?.textContent).toBe("999")
		expect(container.querySelector("#b")?.textContent).toBe("0")
	})

	it("preloadedState seeds the store", () => {
		const { container } = render(() => (
			<RechartsStateProvider preloadedState={{ chartSize: { width: 800, height: 600 } }}>
				<WidthReader />
			</RechartsStateProvider>
		))
		expect(container.textContent).toBe("800")
	})
})
