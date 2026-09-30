/* @jsxImportSource solid-js */
import { describe, it } from "vitest"
import { createRoot } from "solid-js"
import {
	Sankey,
	getRelativeCoordinate,
	SankeyNodeProps,
	SankeyLinkProps,
	SankeyElementType,
} from "../../src"

describe("Sankey types", () => {
	it("should allow calling getRelativeCoordinate with the type provided by Recharts event handler", () => {
		createRoot((dispose) => {
			;(
			<Sankey
				data={{ links: [], nodes: [] }}
				onClick={(_item: SankeyNodeProps | SankeyLinkProps, _type: SankeyElementType, e) => {
					getRelativeCoordinate(e)
				}}
				onMouseEnter={(_item: SankeyNodeProps | SankeyLinkProps, _type: SankeyElementType, e) => {
					getRelativeCoordinate(e)
				}}
				onMouseLeave={(_item: SankeyNodeProps | SankeyLinkProps, _type: SankeyElementType, e) => {
					getRelativeCoordinate(e)
				}}
			/>
			)
			dispose()
		})
	})
})
