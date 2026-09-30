/* @jsxImportSource solid-js */
import { describe, it } from "vitest"
import { createRoot } from "solid-js"
import { ReferenceLine, LineChart, getRelativeCoordinate } from "../../../src"

describe("ReferenceLine types", () => {
	it("should allow calling getRelativeCoordinate with the type provided by Recharts event handler", () => {
		createRoot((dispose) => {
			;(
			<LineChart width={100} height={100}>
				<ReferenceLine
					onClick={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseDown={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseUp={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseMove={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseLeave={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseOver={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseOut={(e) => {
						getRelativeCoordinate(e)
					}}
					onMouseEnter={(e) => {
						getRelativeCoordinate(e)
					}}
					onTouchStart={(e) => {
						getRelativeCoordinate(e)
					}}
					onTouchMove={(e) => {
						getRelativeCoordinate(e)
					}}
					onTouchEnd={(e) => {
						getRelativeCoordinate(e)
					}}
				/>
			</LineChart>
			)
			dispose()
		})
	})
})
