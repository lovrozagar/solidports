/* @jsxImportSource solid-js */
import { describe, it } from "vitest"
import { createRoot } from "solid-js"
import { Legend, getRelativeCoordinate } from "../../src"

describe("Legend types", () => {
	it("should allow calling getRelativeCoordinate with the type provided by Recharts event handler", () => {
		createRoot((dispose) => {
			;(
			<Legend
				onClick={(_data, _index, e) => {
					getRelativeCoordinate(e)
				}}
				onMouseEnter={(_data, _index, e) => {
					getRelativeCoordinate(e)
				}}
				onMouseLeave={(_data, _index, e) => {
					getRelativeCoordinate(e)
				}}
			/>
			)
			dispose()
		})
	})
})
