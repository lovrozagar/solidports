/* @jsxImportSource solid-js */
import { render } from "@solidjs/testing-library"

import { Cell } from "../../src"

describe("<Cell />", () => {
	it("Render empty dom", () => {
		const { container } = render(() => <Cell />)
		expect(container).toBeEmptyDOMElement()
	})
})
