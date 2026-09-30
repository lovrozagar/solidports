/**
 * Solid uses kebab-case for SVG attributes, React uses camelCase.
 * This type adds camelCase aliases for the most commonly-used SVG presentation attributes
 * so ported React code can continue to use props.strokeWidth, props.fillOpacity, etc.
 */
export type CamelCaseSVGAttrs = {
	className?: string
	clipPath?: string
	clipRule?: "nonzero" | "evenodd" | "inherit"
	dominantBaseline?: string
	fillOpacity?: number | string
	fillRule?: "nonzero" | "evenodd" | "inherit"
	fontFamily?: string
	fontSize?: number | string
	fontStyle?: string
	fontWeight?: number | string
	letterSpacing?: number | string
	pointerEvents?: string
	stopColor?: string
	stopOpacity?: number | string
	strokeDasharray?: string
	strokeDashoffset?: number | string
	strokeLinecap?: "butt" | "round" | "square" | "inherit"
	strokeLinejoin?: "miter" | "round" | "bevel" | "inherit"
	strokeMiterlimit?: number | string
	strokeOpacity?: number | string
	strokeWidth?: number | string
	textAnchor?: "start" | "middle" | "end" | "inherit"
	textDecoration?: string
	wordSpacing?: number | string
	writingMode?: string
}
