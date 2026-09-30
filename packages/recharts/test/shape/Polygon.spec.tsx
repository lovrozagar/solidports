import { describe, expect, test } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { Surface, Polygon } from "../../src"
import type { Coordinate } from "../../src/util/types"
import { assertNotNull } from "../helper/assertNotNull"

describe("<Polygon />", () => {
	test("Render 1 path in simple Polygon", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={points} fill="#ff7300" />
			</Surface>
		))

		expect(container.querySelectorAll(".recharts-polygon")).toHaveLength(1)
		expect(container).toMatchSnapshot()
	})
	test("Don't render any path when points is empty or null", () => {
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={[]} fill="#ff7300" />
				<Polygon fill="#ff7300" />
			</Surface>
		))

		expect(container.querySelectorAll(".recharts-polygon")).toHaveLength(0)
	})
	test("Renders null when points array has no valid points", () => {
		const invalidPoints = [
			{ x: NaN, y: 100 },
			{ x: 100, y: NaN },
			{ x: "100", y: 100 },
			null,
			undefined,
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={invalidPoints as unknown as Coordinate[]} fill="#ff7300" />
			</Surface>
		))
		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path.getAttribute("d")).toBe("")
	})
	test("Filters out points with only one valid coordinate", () => {
		const mixedPoints = [
			{ x: 100, y: 100 },
			{ x: NaN, y: 400 },
			{ x: 500, y: NaN },
			{ x: 200, y: 200 },
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={mixedPoints} />
			</Surface>
		))
		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("d")).toBe("M100,100M200,200L100,100")
	})
	test("Render multi paths in simple Polygon when connectNulls is false", () => {
		const pointsWithNull = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
			null,
			{ x: 400, y: 300 },
			{ x: 600, y: 300 },
			{ x: 500, y: 50 },
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon
					points={pointsWithNull as unknown as Coordinate[]}
					fill="#ff7300"
					connectNulls={false}
				/>
			</Surface>
		))

		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("d")).toMatch(/M100,300L300,300L200,50M400,300L600,300L500,50L100,300/)
		expect(container).toMatchSnapshot()
	})
	test("Render 1 path in simple Polygon when connectNulls is true", () => {
		const pointsWithNull = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
			null,
			{ x: 400, y: 300 },
			{ x: 600, y: 300 },
			{ x: 500, y: 50 },
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={pointsWithNull as unknown as Coordinate[]} fill="#ff7300" connectNulls />
			</Surface>
		))

		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("d")).not.toMatch(/M.*Z.*M.*Z/)
		expect(path.getAttribute("d")).toMatch(/^M.*Z$/)
		expect(container).toMatchSnapshot()
	})
	test("Render range polygon with baseLinePoints", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
		]
		const baseLinePoints = [
			{ x: 100, y: 400 },
			{ x: 300, y: 400 },
			{ x: 200, y: 200 },
		]

		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon
					points={points}
					baseLinePoints={baseLinePoints}
					stroke="black"
					fill="blue"
					class="custom-polygon"
				/>
			</Surface>
		))

		const group = container.querySelector(".recharts-polygon.custom-polygon")
		assertNotNull(group)
		expect(group).toBeInTheDocument()
		expect(group.tagName).toBe("g")

		const paths = group.querySelectorAll("path")
		assertNotNull(paths)
		expect(paths).toHaveLength(3)

		expect(paths[0].getAttribute("fill")).toBe("blue")
		expect(paths[0].getAttribute("stroke")).toBe("none")
		expect(paths[0].getAttribute("d")).toBe(
			"M100,300L300,300L200,50L100,300L200,200L300,400L100,400L200,200Z",
		)

		expect(paths[1].getAttribute("fill")).toBe("none")
		expect(paths[1].getAttribute("stroke")).toBe("black")
		expect(paths[1].getAttribute("d")).toMatch(/M100,300L300,300L200,50L100,300Z/)

		expect(paths[2].getAttribute("fill")).toBe("none")
		expect(paths[2].getAttribute("stroke")).toBe("black")
		expect(paths[2].getAttribute("d")).toMatch(/M100,400L300,400L200,200L100,400Z/)
	})
	test("Render range polygon with discontinuous points (no Z in outerPath)", () => {
		const pointsWithNull = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			null,
			{ x: 400, y: 300 },
			{ x: 600, y: 300 },
		]
		const baseLinePoints = [
			{ x: 100, y: 400 },
			{ x: 600, y: 400 },
		]

		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon
					points={pointsWithNull as unknown as Coordinate[]}
					baseLinePoints={baseLinePoints}
					connectNulls={false}
					fill="blue"
				/>
			</Surface>
		))
		const group = container.querySelector(".recharts-polygon")
		assertNotNull(group)
		const path = group.querySelector("path")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("fill")).toBe("blue")
		const d = path.getAttribute("d")
		expect(d).toContain("M100,300")
		expect(d).toMatch(/L100,300L600,400/)
	})
	test("Render range polygon with discontinuous baseline (no Z in rangePath)", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 600, y: 300 },
		]
		const baseLineWithNull: ReadonlyArray<Coordinate> = [
			{ x: 100, y: 400 },
			null as unknown as Coordinate,
			{ x: 600, y: 400 },
		]

		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon
					points={points}
					baseLinePoints={baseLineWithNull}
					connectNulls={false}
					fill="blue"
				/>
			</Surface>
		))

		const group = container.querySelector(".recharts-polygon")
		assertNotNull(group)
		const path = group.querySelector("path")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("fill")).toBe("none")

		const d = path.getAttribute("d")
		expect(d).toContain("M100,300")
		expect(d).toContain("600,400")
		expect(d).toContain("100,400")
		expect(d).not.toMatch(/Z$/)
	})
	test("Render range polygon without stroke", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
		]
		const baseLinePoints = [
			{ x: 100, y: 400 },
			{ x: 300, y: 400 },
			{ x: 200, y: 200 },
		]

		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={points} baseLinePoints={baseLinePoints} stroke="none" fill="blue" />
			</Surface>
		))

		const group = container.querySelector(".recharts-polygon")
		assertNotNull(group)
		const paths = group.querySelectorAll("path")
		expect(paths).toHaveLength(1)
		expect(paths[0].getAttribute("fill")).toBe("blue")
	})
	test("Handles events correctly", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
		]
		const onClick = vi.fn()
		const onMouseEnter = vi.fn()
		const onMouseLeave = vi.fn()

		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon
					points={points}
					onClick={onClick}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			</Surface>
		))

		const path = container.querySelector(".recharts-polygon")
		if (path) {
			fireEvent.click(path)
			expect(onClick).toHaveBeenCalled()
			fireEvent.mouseEnter(path)
			expect(onMouseEnter).toHaveBeenCalled()
			fireEvent.mouseLeave(path)
			expect(onMouseLeave).toHaveBeenCalled()
		}
	})
	test("Renders standard polygon with custom className", () => {
		const points = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 },
			{ x: 200, y: 50 },
		]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={points} class="my-custom-polygon" />
			</Surface>
		))
		expect(container.querySelector(".recharts-polygon.my-custom-polygon")).toBeInTheDocument()
	})
	test("Handles single point correctly", () => {
		const singlePoint = [{ x: 100, y: 100 }]
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={singlePoint} />
			</Surface>
		))
		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("d")).toBe("M100,100L100,100Z")
	})
	test("Correctly handles last invalid point if it causes empty segment", () => {
		const { container } = render(() => (
			<Surface width={400} height={400}>
				<Polygon points={[{ x: NaN, y: NaN }]} />
			</Surface>
		))
		const path = container.querySelector(".recharts-polygon")
		assertNotNull(path)
		expect(path).toBeInTheDocument()
		expect(path.getAttribute("d")).toBe("")
	})
})
