/* @jsxImportSource @solidjs/web */
import { render } from "../helper/render"

import { Cell } from "../../src"

describe("<Cell />", () => {
	it("Render empty dom", () => {
		const { container } = render(() => <Cell />)
		expect(container).toBeEmptyDOMElement()
	})
})
