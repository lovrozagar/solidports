/* @jsxImportSource solid-js */
import { describe, it } from "vitest"
import { createRoot } from "solid-js"
import { Treemap, getRelativeCoordinate, TreemapNode } from "../../src"

describe("Treemap types", () => {
	it("should allow calling getRelativeCoordinate with the type provided by Recharts event handler", () => {
		createRoot((dispose) => {
			;(
			<Treemap
				width={400}
				height={400}
				data={[]}
				dataKey="value"
				onMouseEnter={(_node: TreemapNode, e) => {
					getRelativeCoordinate(e)
				}}
				onMouseLeave={(_node: TreemapNode, e) => {
					getRelativeCoordinate(e)
				}}
				// onClick does not provide event in Treemap props currently
				onClick={(_node: TreemapNode) => {}}
			/>
			)
			dispose()
		})
	})
})
