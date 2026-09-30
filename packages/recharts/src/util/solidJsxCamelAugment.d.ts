/*
 * 1:1 React parity — upstream recharts API uses camelCase SVG attrs
 * (`fillOpacity`, `strokeWidth`, ...). Solid's `JSX.SvgSVGAttributes` and
 * the per-element interfaces (`PathSVGAttributes`, `LineSVGAttributes`,
 * `GSVGAttributes`, etc.) only declare kebab-case. Module-augment the
 * shared base interfaces so every SVG element shape accepts both forms
 * at the type level. Runtime rekeys camel → kebab via `SVG_CAMEL_TO_KEBAB`
 * in `svgPropertiesNoEvents.ts`.
 *
 * Augmenting `ShapeElementSVGAttributes` covers Path/Line/Rect/Circle/Ellipse/Polygon/Polyline.
 * Augmenting `TextContentElementSVGAttributes` covers `<text>`/`<tspan>`.
 * Augmenting `StylableSVGAttributes` covers `class` → `className`.
 * Augmenting `ContainerElementSVGAttributes` covers `<g>` (and any container).
 */

import type { JSX as SolidJSX } from "solid-js"

declare module "solid-js" {
	namespace JSX {
		interface StylableSVGAttributes {
			className?: string
		}

		interface ShapeElementSVGAttributes<T> {
			fillOpacity?: number | string
			fillRule?: "nonzero" | "evenodd" | "inherit"
			strokeDasharray?: string
			strokeDashoffset?: number | string
			strokeLinecap?: "butt" | "round" | "square" | "inherit"
			strokeLinejoin?: "miter" | "round" | "bevel" | "inherit"
			strokeMiterlimit?: number | string
			strokeOpacity?: number | string
			strokeWidth?: number | string
		}

		interface TextContentElementSVGAttributes<T> {
			dominantBaseline?: string
			fillOpacity?: number | string
			fillRule?: "nonzero" | "evenodd" | "inherit"
			fontFamily?: string
			fontSize?: number | string
			fontStyle?: string
			fontWeight?: number | string
			letterSpacing?: number | string
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

		interface ContainerElementSVGAttributes<T> {
			clipPath?: string
			pointerEvents?: string
		}

		/* `<svg>` element — inherits via SvgSVGAttributes; covers root chart Surface. */
		interface SvgSVGAttributes<T> {
			clipPath?: string
			fillOpacity?: number | string
			fillRule?: "nonzero" | "evenodd" | "inherit"
			pointerEvents?: string
			strokeDasharray?: string
			strokeDashoffset?: number | string
			strokeLinecap?: "butt" | "round" | "square" | "inherit"
			strokeLinejoin?: "miter" | "round" | "bevel" | "inherit"
			strokeMiterlimit?: number | string
			strokeOpacity?: number | string
			strokeWidth?: number | string
		}
	}
}

/*
 * Re-export to keep the file referenced when imported solely for side-effect
 * type augmentation; consumers do `import "@solidports/recharts"` and the
 * augmentation flows transitively through `src/index.ts`'s reference.
 */
export type _SolidJSXCamelAugmentMarker = SolidJSX.Element
