/* eslint-disable import/no-cycle */
import type { JSX } from "solid-js"
import { Show } from "solid-js"

import {
	symbol as shapeSymbol,
	symbolCircle,
	symbolCross,
	symbolDiamond,
	symbolSquare,
	symbolStar,
	symbolTriangle,
	symbolWye,
	type SymbolType as D3SymbolType,
} from "victory-vendor/d3-shape"
import { clsx } from "clsx"
import type { SymbolType } from "../util/types"
import { isNumber, upperFirst } from "../util/DataUtils"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"

type SizeType = "area" | "diameter"

interface SymbolFactory {
	[type: string]: D3SymbolType
}

const symbolFactories: SymbolFactory = {
	symbolCircle,
	symbolCross,
	symbolDiamond,
	symbolSquare,
	symbolStar,
	symbolTriangle,
	symbolWye,
}
const RADIAN = Math.PI / 180

const getSymbolFactory = (type: SymbolType) => {
	const name = `symbol${upperFirst(type)}`

	return symbolFactories[name] || symbolCircle
}

const calculateAreaSize = (size: number, sizeType: SizeType, type: SymbolType) => {
	if (sizeType === "area") {
		return size
	}

	switch (type) {
		case "cross":
			return (5 * size * size) / 9
		case "diamond":
			return (0.5 * size * size) / Math.sqrt(3)
		case "square":
			return size * size
		case "star": {
			const angle = 18 * RADIAN

			return 1.25 * size * size * (Math.tan(angle) - Math.tan(angle * 2) * Math.tan(angle) ** 2)
		}
		case "triangle":
			return (Math.sqrt(3) * size * size) / 4
		case "wye":
			return ((21 - 10 * Math.sqrt(3)) * size * size) / 8
		default:
			return (Math.PI * size * size) / 4
	}
}

export interface InnerSymbolsProp {
	class?: string
	type?: SymbolType
	cx?: number
	cy?: number
	size?: number
	sizeType?: SizeType
}

export type SymbolsProps = Omit<JSX.PathSVGAttributes<SVGPathElement>, "type"> & InnerSymbolsProp

const registerSymbol = (key: string, factory: D3SymbolType) => {
	symbolFactories[`symbol${upperFirst(key)}`] = factory
}

/**
 * Calculate the path of curve
 * @return path
 */
const getSymbolPath = (type: SymbolType, size: number, sizeType: SizeType): string | undefined => {
	const symbolFactory = getSymbolFactory(type)
	const symbol = shapeSymbol()
		.type(symbolFactory)
		.size(calculateAreaSize(size, sizeType, type))

	const s = symbol()
	if (s === null) {
		return undefined
	}
	return s
}

/**
 * Renders a symbol from a set of predefined shapes.
 */
export function Symbols(props: SymbolsProps) {
	const type = () => {
		const t = props.type ?? "circle"
		if (typeof t === "string") {
			/*
			 * Our type guard is not as strong as it could be (i.e. non-existent),
			 * and so despite the typescript type saying that `type` is a `SymbolType`,
			 * we can get numbers or really anything, so let's have a runtime check here to fix the exception.
			 *
			 * https://github.com/recharts/recharts/issues/6197
			 */
			return t
		}
		return "circle" as SymbolType
	}
	const size = () => props.size ?? 64
	const sizeType = () => props.sizeType ?? "area"

	const isValid = () => isNumber(props.cx) && isNumber(props.cy) && isNumber(size())

	return (
		<Show when={isValid()}>
			<path
				{...svgPropertiesAndEvents(props)}
				class={clsx("recharts-symbols", props.class)}
				transform={`translate(${props.cx}, ${props.cy})`}
				d={getSymbolPath(type(), size(), sizeType())}
			/>
		</Show>
	)
}

Symbols.registerSymbol = registerSymbol
