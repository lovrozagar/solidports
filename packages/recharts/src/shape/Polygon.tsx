/**
 * @fileOverview Polygon
 */
import type { JSX } from '@solidjs/web';
import { useShapeElementProps } from "../util/ShapeElementProps"
import type { WithoutRemoveFalse } from "../util/types"
import { Show } from 'solid-js';
import { clsx } from "clsx"
import type { Coordinate } from "../util/types"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { roundTemplateLiteral } from "../util/round"

const isValidatePoint = (point: Coordinate | undefined): point is Coordinate => {
	return point != null && point.x === +point.x && point.y === +point.y
}

const getParsedPoints = (points: ReadonlyArray<Coordinate> = []) => {
	let segmentPoints: Coordinate[][] = [[]]

	points.forEach((entry) => {
		const lastLink = segmentPoints[segmentPoints.length - 1]
		if (isValidatePoint(entry)) {
			if (lastLink) {
				lastLink.push(entry)
			}
		} else if (lastLink && lastLink.length > 0) {
			segmentPoints.push([])
		}
	})

	const firstPoint = points[0]
	const lastLink = segmentPoints[segmentPoints.length - 1]
	if (isValidatePoint(firstPoint) && lastLink) {
		lastLink.push(firstPoint)
	}

	const finalLink = segmentPoints[segmentPoints.length - 1]
	if (finalLink && finalLink.length <= 0) {
		segmentPoints = segmentPoints.slice(0, -1)
	}

	return segmentPoints
}

const getSinglePolygonPath = (points: ReadonlyArray<Coordinate>, connectNulls?: boolean) => {
	let segmentPoints = getParsedPoints(points)

	if (connectNulls) {
		segmentPoints = [
			segmentPoints.reduce((res: Coordinate[], segPoints: Coordinate[]) => {
				res.push(...segPoints)
				return res
			}, []),
		]
	}

	const polygonPath = segmentPoints
		.map((segPoints) => {
			return segPoints.reduce((path: string, point: Coordinate, index: number) => {
				return roundTemplateLiteral`${path}${index === 0 ? "M" : "L"}${point.x},${point.y}`
			}, "")
		})
		.join("")

	return segmentPoints.length === 1 ? `${polygonPath}Z` : polygonPath
}

const getRanglePath = (
	points: ReadonlyArray<Coordinate>,
	baseLinePoints: ReadonlyArray<Coordinate>,
	connectNulls?: boolean,
) => {
	const outerPath = getSinglePolygonPath(points, connectNulls)

	return `${outerPath.slice(-1) === "Z" ? outerPath.slice(0, -1) : outerPath}L${getSinglePolygonPath(
		Array.from(baseLinePoints).reverse(),
		connectNulls,
	).slice(1)}`
}

interface PolygonProps {
	class?: string
	/**
	 * The coordinates of all the vertexes of the polygon, like an array of objects with x and y coordinates.
	 */
	points?: ReadonlyArray<Coordinate>
	baseLinePoints?: ReadonlyArray<Coordinate>
	connectNulls?: boolean

	/**
	 * The customized event handler of click on the polygon
	 */
	onClick?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mousedown on the polygon
	 */
	onMouseDown?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseup on the polygon
	 */
	onMouseUp?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mousemove on the polygon
	 */
	onMouseMove?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseover on the polygon
	 */
	onMouseOver?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseout on the polygon
	 */
	onMouseOut?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseenter on the polygon
	 */
	onMouseEnter?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
	/**
	 * The customized event handler of mouseleave on the polygon
	 */
	onMouseLeave?: (e: MouseEvent & { currentTarget: SVGPathElement }) => void
}

export type Props = WithoutRemoveFalse<Omit<JSX.PathSVGAttributes<SVGPathElement>, "points" | keyof PolygonProps>> & PolygonProps

export function Polygon(ownProps: Props) {
	/* Props injected for a shape passed as an element (see ShapeElementProps). */
	const props = useShapeElementProps(ownProps)
	const hasPoints = () => props.points && props.points.length > 0

	return (
		<Show when={hasPoints()}>
			<Show
				when={props.baseLinePoints && props.baseLinePoints.length > 0}
				fallback={
					<SinglePolygonPath
						points={props.points}
						connectNulls={props.connectNulls}
						class={props.class}
						{...svgPropertiesAndEvents(props)}
					/>
				}
			>
				<RangePolygon
					points={props.points}
					baseLinePoints={props.baseLinePoints}
					connectNulls={props.connectNulls}
					class={props.class}
					{...svgPropertiesAndEvents(props)}
				/>
			</Show>
		</Show>
	)
}

function SinglePolygonPath(props: Props) {
	const layerClass = () => clsx("recharts-polygon", props.class)
	const singlePath = () => getSinglePolygonPath(props.points ?? [], props.connectNulls)

	return (
		<path
			{...svgPropertiesAndEvents(props)}
			fill={singlePath().slice(-1) === "Z" ? props.fill : "none"}
			class={layerClass()}
			d={singlePath()}
		/>
	)
}

function RangePolygon(props: Props) {
	const layerClass = () => clsx("recharts-polygon", props.class)
	const hasStroke = () => props.stroke && props.stroke !== "none"
	const rangePath = () =>
		getRanglePath(props.points ?? [], props.baseLinePoints ?? [], props.connectNulls)
	const singlePath = () => getSinglePolygonPath(props.points ?? [], props.connectNulls)
	const baseLinePath = () => getSinglePolygonPath(props.baseLinePoints ?? [], props.connectNulls)
	const filteredProps = () => svgPropertiesAndEvents(props)

	return (
		<g class={layerClass()}>
			<path
				{...filteredProps()}
				fill={rangePath().slice(-1) === "Z" ? props.fill : "none"}
				stroke="none"
				d={rangePath()}
			/>
			<Show when={hasStroke()}>
				<path {...filteredProps()} fill="none" d={singlePath()} />
			</Show>
			<Show when={hasStroke()}>
				<path {...filteredProps()} fill="none" d={baseLinePath()} />
			</Show>
		</g>
	)
}
