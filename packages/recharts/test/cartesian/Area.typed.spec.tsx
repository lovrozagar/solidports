import { describe, it } from "vitest"
import { createRoot } from "solid-js"
import { Area, AreaChart, CurveProps, getRelativeCoordinate } from "../../src"

describe("Area types", () => {
	it("should allow calling getRelativeCoordinate with the type provided by Recharts event handler", () => {
		createRoot((dispose) => {
			;(
			<AreaChart width={100} height={100}>
				<Area
					dataKey="foo"
					onClick={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseDown={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseUp={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseMove={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseLeave={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseOver={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseOut={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onMouseEnter={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onTouchStart={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onTouchMove={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
					onTouchEnd={(_data: CurveProps, e) => {
						getRelativeCoordinate(e)
					}}
				/>
			</AreaChart>
			)
			dispose()
		})
	})
})
