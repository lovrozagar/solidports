import type { JSX } from '@solidjs/web';
import { createMemo } from "solid-js"
import { splitProps } from "../util/solid-1-compat"
import { Curve, type Props as CurveProps } from "../shape/Curve"
import type { ShapeAnimationProps } from "../util/types"

function getTotalLength(path: SVGPathElement | null): number {
	try {
		return (path && path.getTotalLength && path.getTotalLength()) || 0
	} catch {
		return 0
	}
}

function generateSimpleStrokeDasharray(totalLength: number, length: number): string {
	return `${length}px ${totalLength}px`
}

function normalizeDashPattern(lines: number[]): number[] {
	return lines.length % 2 !== 0 ? [...lines, ...lines] : lines
}

function repeat(lines: number[], count: number): number[] {
	const result: number[] = []
	for (let i = 0; i < count; ++i) {
		result.push(...lines)
	}
	return result
}

function getStrokeDasharray(length: number, totalLength: number, lines: number[]): string {
	const normalizedLines = normalizeDashPattern(lines)
	const lineLength = normalizedLines.reduce((pre, next) => pre + next, 0)
	if (!lineLength) {
		return generateSimpleStrokeDasharray(totalLength, length)
	}
	const count = Math.floor(length / lineLength)
	const remainLength = length % lineLength
	let remainLines: number[] = []
	for (let i = 0, sum = 0; i < normalizedLines.length; sum += normalizedLines[i] ?? 0, ++i) {
		const lineValue = normalizedLines[i]
		if (lineValue != null && sum + lineValue > remainLength) {
			remainLines = [...normalizedLines.slice(0, i), remainLength - sum]
			break
		}
	}
	const emptyLines = remainLines.length % 2 === 0 ? [0, totalLength] : [totalLength]
	return [...repeat(normalizedLines, count), ...remainLines, ...emptyLines]
		.map((line) => `${line}px`)
		.join(", ")
}

function computeAnimatedStrokeDasharray(
	userStrokeDasharray: string | number | undefined,
	totalLength: number,
	visibleLength: number,
): string {
	if (userStrokeDasharray) {
		const lines = `${userStrokeDasharray}`.split(/[,\s]+/gim).map((num) => parseFloat(num))
		return getStrokeDasharray(visibleLength, totalLength, lines)
	}
	return generateSimpleStrokeDasharray(totalLength, visibleLength)
}

export type LineDrawShapeProps = Omit<CurveProps, "pathRef"> &
	ShapeAnimationProps & {
		pathRef?: { current: SVGPathElement | null }
		visibleLength?: number | null
	}

/**
 * Default Line shape. During entrance animation the path is revealed via stroke-dasharray.
 *
 * @since 3.9
 */
export function LineDrawShape(props: LineDrawShapeProps): JSX.Element {
	/* Animation state is consumed here and never forwarded to the <path>. */
	const [local, curveProps] = splitProps(props, [
		"animationElapsedTime",
		"isAnimating",
		"isEntrance",
		"visibleLength",
		"strokeDasharray",
		"connectNulls",
	])

	const strokeDasharray = createMemo((): string | undefined => {
		if (local.visibleLength != null) {
			const totalLength = getTotalLength(curveProps.pathRef?.current ?? null)
			return computeAnimatedStrokeDasharray(local.strokeDasharray, totalLength, local.visibleLength)
		}
		return local.strokeDasharray == null ? undefined : String(local.strokeDasharray)
	})

	return <Curve {...curveProps} connectNulls={local.connectNulls ?? false} strokeDasharray={strokeDasharray()} />
}
