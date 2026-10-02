/* @jsxImportSource @solidjs/web */
import { render, screen } from "../helper/render"
import { Customized } from "../../src"

describe("<Customized />", () => {
	test("Render customized component by React.element", () => {
		function CustomEl() {
			return <rect data-testid="customized-svg-element" />
		}
		render(() => (
			<svg>
				<Customized component={<CustomEl />} />
			</svg>
		))
		expect(screen.getByTestId("customized-svg-element")).toBeTruthy()
	})
	test("Render customized component by element", () => {
		function CustomEl() {
			return <rect data-testid="customized-svg-element" />
		}
		render(() => (
			<svg>
				<Customized component={CustomEl} />
			</svg>
		))
		expect(screen.getByTestId("customized-svg-element")).toBeTruthy()
	})
	test("Render customized component by Function", () => {
		const Custom = () => <rect data-testid="customized-svg-element" />

		render(() => (
			<svg>
				<Customized component={Custom} />
			</svg>
		))
		expect(screen.getByTestId("customized-svg-element")).toBeTruthy()
	})
})
