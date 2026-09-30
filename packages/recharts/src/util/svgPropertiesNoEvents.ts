const SVGElementPropKeys = [
	"aria-activedescendant",
	"aria-atomic",
	"aria-autocomplete",
	"aria-busy",
	"aria-checked",
	"aria-colcount",
	"aria-colindex",
	"aria-colspan",
	"aria-controls",
	"aria-current",
	"aria-describedby",
	"aria-details",
	"aria-disabled",
	"aria-errormessage",
	"aria-expanded",
	"aria-flowto",
	"aria-haspopup",
	"aria-hidden",
	"aria-invalid",
	"aria-keyshortcuts",
	"aria-label",
	"aria-labelledby",
	"aria-level",
	"aria-live",
	"aria-modal",
	"aria-multiline",
	"aria-multiselectable",
	"aria-orientation",
	"aria-owns",
	"aria-placeholder",
	"aria-posinset",
	"aria-pressed",
	"aria-readonly",
	"aria-relevant",
	"aria-required",
	"aria-roledescription",
	"aria-rowcount",
	"aria-rowindex",
	"aria-rowspan",
	"aria-selected",
	"aria-setsize",
	"aria-sort",
	"aria-valuemax",
	"aria-valuemin",
	"aria-valuenow",
	"aria-valuetext",
	"className",
	"color",
	"height",
	"id",
	"lang",
	"max",
	"media",
	"method",
	"min",
	"name",
	"style",
	/*
	 * removed 'type' SVGElementPropKey because we do not currently use any SVG elements
	 * that can use it, and it conflicts with the recharts prop 'type'
	 * https://github.com/recharts/recharts/pull/3327
	 * https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/type
	 */
	"target",
	"width",
	"role",
	"tabIndex",
	"accentHeight",
	"accumulate",
	"additive",
	"alignmentBaseline",
	"allowReorder",
	"alphabetic",
	"amplitude",
	"arabicForm",
	"ascent",
	"attributeName",
	"attributeType",
	"autoReverse",
	"azimuth",
	"baseFrequency",
	"baselineShift",
	"baseProfile",
	"bbox",
	"begin",
	"bias",
	"by",
	"calcMode",
	"capHeight",
	"clip",
	"clipPath",
	"clipPathUnits",
	"clipRule",
	"colorInterpolation",
	"colorInterpolationFilters",
	"colorProfile",
	"colorRendering",
	"contentScriptType",
	"contentStyleType",
	"cursor",
	"cx",
	"cy",
	"d",
	"decelerate",
	"descent",
	"diffuseConstant",
	"direction",
	"display",
	"divisor",
	"dominantBaseline",
	"dur",
	"dx",
	"dy",
	"edgeMode",
	"elevation",
	"enableBackground",
	"end",
	"exponent",
	"externalResourcesRequired",
	"fill",
	"fill-opacity",
	"fillOpacity",
	"fill-rule",
	"fillRule",
	"filter",
	"filterRes",
	"filterUnits",
	"floodColor",
	"floodOpacity",
	"focusable",
	"fontFamily",
	"fontSize",
	"fontSizeAdjust",
	"fontStretch",
	"fontStyle",
	"fontVariant",
	"fontWeight",
	"format",
	"from",
	"fx",
	"fy",
	"g1",
	"g2",
	"glyphName",
	"glyphOrientationHorizontal",
	"glyphOrientationVertical",
	"glyphRef",
	"gradientTransform",
	"gradientUnits",
	"hanging",
	"horizAdvX",
	"horizOriginX",
	"href",
	"ideographic",
	"imageRendering",
	"in2",
	"in",
	"intercept",
	"k1",
	"k2",
	"k3",
	"k4",
	"k",
	"kernelMatrix",
	"kernelUnitLength",
	"kerning",
	"keyPoints",
	"keySplines",
	"keyTimes",
	"lengthAdjust",
	"letterSpacing",
	"lightingColor",
	"limitingConeAngle",
	"local",
	"markerEnd",
	"markerHeight",
	"markerMid",
	"markerStart",
	"markerUnits",
	"markerWidth",
	"mask",
	"maskContentUnits",
	"maskUnits",
	"mathematical",
	"mode",
	"numOctaves",
	"offset",
	"opacity",
	"operator",
	"order",
	"orient",
	"orientation",
	"origin",
	"overflow",
	"overlinePosition",
	"overlineThickness",
	"paintOrder",
	"panose1",
	"pathLength",
	"patternContentUnits",
	"patternTransform",
	"patternUnits",
	"pointerEvents",
	"pointsAtX",
	"pointsAtY",
	"pointsAtZ",
	"preserveAlpha",
	"preserveAspectRatio",
	"primitiveUnits",
	"r",
	"radius",
	"refX",
	"refY",
	"renderingIntent",
	"repeatCount",
	"repeatDur",
	"requiredExtensions",
	"requiredFeatures",
	"restart",
	"result",
	"rotate",
	"rx",
	"ry",
	"seed",
	"shapeRendering",
	"slope",
	"spacing",
	"specularConstant",
	"specularExponent",
	"speed",
	"spreadMethod",
	"startOffset",
	"stdDeviation",
	"stemh",
	"stemv",
	"stitchTiles",
	"stopColor",
	"stopOpacity",
	"strikethroughPosition",
	"strikethroughThickness",
	"string",
	"stroke",
	"strokeDasharray",
	"strokeDashoffset",
	"strokeLinecap",
	"strokeLinejoin",
	"strokeMiterlimit",
	"strokeOpacity",
	"stroke-width",
	"strokeWidth",
	"surfaceScale",
	"systemLanguage",
	"tableValues",
	"targetX",
	"targetY",
	"textAnchor",
	"textDecoration",
	"textLength",
	"textRendering",
	"to",
	"transform",
	"u1",
	"u2",
	"underlinePosition",
	"underlineThickness",
	"unicode",
	"unicodeBidi",
	"unicodeRange",
	"unitsPerEm",
	"vAlphabetic",
	"values",
	"vectorEffect",
	"version",
	"vertAdvY",
	"vertOriginX",
	"vertOriginY",
	"vHanging",
	"vIdeographic",
	"viewTarget",
	"visibility",
	"vMathematical",
	"widths",
	"wordSpacing",
	"writingMode",
	"x1",
	"x2",
	"x",
	"xChannelSelector",
	"xHeight",
	"xlinkActuate",
	"xlinkArcrole",
	"xlinkHref",
	"xlinkRole",
	"xlinkShow",
	"xlinkTitle",
	"xlinkType",
	"xmlBase",
	"xmlLang",
	"xmlns",
	"xmlnsXlink",
	"xmlSpace",
	"y1",
	"y2",
	"y",
	"yChannelSelector",
	"z",
	"zoomAndPan",
	"ref",
	"angle",
] as const

export type SVGElementPropKeysType = (typeof SVGElementPropKeys)[number]

const SVGElementPropKeySet = new Set<string>(SVGElementPropKeys)

/* Kebab-case forms also accepted at the boundary so callers can write
 * `clip-path` directly in JSX without losing the attr through the
 * svgPropertiesAndEvents filter. Filled lazily from SVG_CAMEL_TO_KEBAB. */
let SVGElementKebabKeySet: Set<string> | null = null
function getKebabKeySet(): Set<string> {
	if (SVGElementKebabKeySet === null) {
		SVGElementKebabKeySet = new Set<string>()
		for (const v of SVG_CAMEL_TO_KEBAB.values()) SVGElementKebabKeySet.add(v)
	}
	return SVGElementKebabKeySet
}

export function isSvgElementPropKey(key: PropertyKey): boolean {
	if (typeof key !== "string") {
		return false
	}
	if (SVGElementPropKeySet.has(key)) return true
	return getKebabKeySet().has(key)
}

export type DataAttributeKeyType = `data-${string}`

export type SVGPropsNoEvents<T> = Pick<
	T,
	Extract<keyof T, SVGElementPropKeysType | DataAttributeKeyType>
>

/**
 * Checks if the property is a data attribute.
 * @param key The property key.
 * @returns True if the key starts with 'data-', false otherwise.
 */
export function isDataAttribute(key: PropertyKey): key is DataAttributeKeyType {
	return typeof key === "string" && key.startsWith("data-")
}

/* React serializes camelCase SVG props as kebab-case attributes. Solid's
 * runtime spread uses setAttribute verbatim for unknown keys, so
 * `strokeDasharray` lands on the DOM as `strokeDasharray=` instead of
 * `stroke-dasharray=`. Tests (and CSS selectors) query the spec-canonical
 * kebab form, so we re-key here at the public extraction boundary.
 *
 * Set of camelCase SVG presentation attribute names that must serialize as
 * kebab-case. Pure compound camelCase tokens — single-word attrs (`width`,
 * `height`, `id`, etc.) stay unchanged. */
const SVG_CAMEL_TO_KEBAB = new Map<string, string>([
	["accentHeight", "accent-height"],
	["alignmentBaseline", "alignment-baseline"],
	["arabicForm", "arabic-form"],
	["baselineShift", "baseline-shift"],
	["capHeight", "cap-height"],
	["clipPath", "clip-path"],
	["clipPathUnits", "clipPathUnits"],
	["clipRule", "clip-rule"],
	["colorInterpolation", "color-interpolation"],
	["colorInterpolationFilters", "color-interpolation-filters"],
	["colorProfile", "color-profile"],
	["colorRendering", "color-rendering"],
	["dominantBaseline", "dominant-baseline"],
	["enableBackground", "enable-background"],
	["fillOpacity", "fill-opacity"],
	["fillRule", "fill-rule"],
	["floodColor", "flood-color"],
	["floodOpacity", "flood-opacity"],
	["fontFamily", "font-family"],
	["fontSize", "font-size"],
	["fontSizeAdjust", "font-size-adjust"],
	["fontStretch", "font-stretch"],
	["fontStyle", "font-style"],
	["fontVariant", "font-variant"],
	["fontWeight", "font-weight"],
	["glyphName", "glyph-name"],
	["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
	["glyphOrientationVertical", "glyph-orientation-vertical"],
	["horizAdvX", "horiz-adv-x"],
	["horizOriginX", "horiz-origin-x"],
	["imageRendering", "image-rendering"],
	["letterSpacing", "letter-spacing"],
	["lightingColor", "lighting-color"],
	["markerEnd", "marker-end"],
	["markerMid", "marker-mid"],
	["markerStart", "marker-start"],
	["overlinePosition", "overline-position"],
	["overlineThickness", "overline-thickness"],
	["paintOrder", "paint-order"],
	["panose1", "panose-1"],
	["pointerEvents", "pointer-events"],
	["renderingIntent", "rendering-intent"],
	["shapeRendering", "shape-rendering"],
	["stopColor", "stop-color"],
	["stopOpacity", "stop-opacity"],
	["strikethroughPosition", "strikethrough-position"],
	["strikethroughThickness", "strikethrough-thickness"],
	["strokeDasharray", "stroke-dasharray"],
	["strokeDashoffset", "stroke-dashoffset"],
	["strokeLinecap", "stroke-linecap"],
	["strokeLinejoin", "stroke-linejoin"],
	["strokeMiterlimit", "stroke-miterlimit"],
	["strokeOpacity", "stroke-opacity"],
	["strokeWidth", "stroke-width"],
	["textAnchor", "text-anchor"],
	["textDecoration", "text-decoration"],
	["textRendering", "text-rendering"],
	["underlinePosition", "underline-position"],
	["underlineThickness", "underline-thickness"],
	["unicodeBidi", "unicode-bidi"],
	["unicodeRange", "unicode-range"],
	["unitsPerEm", "units-per-em"],
	["vAlphabetic", "v-alphabetic"],
	["vectorEffect", "vector-effect"],
	["vertAdvY", "vert-adv-y"],
	["vertOriginX", "vert-origin-x"],
	["vertOriginY", "vert-origin-y"],
	["vHanging", "v-hanging"],
	["vIdeographic", "v-ideographic"],
	["vMathematical", "v-mathematical"],
	["wordSpacing", "word-spacing"],
	["writingMode", "writing-mode"],
	["xHeight", "x-height"],
	/* HTML/SVG focus + a11y attrs: when forwarded via spread (`{...attrs}`),
	 * Solid writes the key verbatim via `setAttribute`. Browsers parse HTML
	 * attrs case-insensitively but `getAttribute("tabindex")` matches exactly
	 * the stored name — and tests assert the lowercase form. */
	["tabIndex", "tabindex"],
	["readOnly", "readonly"],
	["contentEditable", "contenteditable"],
	["spellCheck", "spellcheck"],
	["autoFocus", "autofocus"],
])

export function canonicalSvgKey(key: string): string {
	return SVG_CAMEL_TO_KEBAB.get(key) ?? key
}

/* Reverse map of SVG_CAMEL_TO_KEBAB, plus `class` -> `className`. Used to
 * present user-facing handler payloads (onClick(props,...)) in the camelCase
 * shape upstream React tests expect. The DOM attribute name stays kebab — only
 * the in-memory object passed to the user handler is normalized. */
let SVG_KEBAB_TO_CAMEL: Map<string, string> | null = null
function getKebabToCamelMap(): Map<string, string> {
	if (SVG_KEBAB_TO_CAMEL === null) {
		SVG_KEBAB_TO_CAMEL = new Map<string, string>()
		for (const [camel, kebab] of SVG_CAMEL_TO_KEBAB.entries()) {
			if (camel !== kebab) SVG_KEBAB_TO_CAMEL.set(kebab, camel)
		}
		SVG_KEBAB_TO_CAMEL.set("class", "className")
	}
	return SVG_KEBAB_TO_CAMEL
}

/* Renames kebab SVG attrs (and `class`) to upstream React camelCase before the
 * payload is handed to user-supplied handlers. Keeps non-mapped keys verbatim
 * (data-*, event keys, points/baseLine/etc. that are pass-through camel). */
export function camelizeSvgPropsForHandler<T extends object>(obj: T): T {
	const map = getKebabToCamelMap()
	const out: Record<string, unknown> = {}
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const renamed = map.get(key) ?? key
			out[renamed] = (obj as Record<string, unknown>)[key]
		}
	}
	return out as T
}

/**
 * Filters an object to only include SVG properties. Removes all event handlers too.
 * @param obj - The object to filter
 * @returns A new object containing only valid SVG properties, excluding event handlers.
 */
export function svgPropertiesNoEvents<T extends object>(obj: T | boolean): SVGPropsNoEvents<T> {
	if (typeof obj !== "object" || obj === null) {
		return {} as SVGPropsNoEvents<T>
	}
	const result: Record<PropertyKey, unknown> = {}

	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			if (isSvgElementPropKey(key) || isDataAttribute(key)) {
				result[canonicalSvgKey(key)] = obj[key]
			}
		}
	}
	return result as SVGPropsNoEvents<T>
}

/**
 * Function to filter SVG properties from various input types.
 * The input types can be:
 * - A record of string keys to any values, in which case it returns a record of only SVG properties
 * - A JSX Element, in which case it returns null (Solid elements are opaque, unlike React)
 * - Anything else, in which case it returns null
 *
 * If you wish to have a type-safe version, use svgPropertiesNoEvents directly with a typed object.
 *
 * @param input - The input to filter, which can be a record or other types.
 * @returns A record of SVG properties if the input is a record, otherwise null.
 */
export function svgPropertiesNoEventsFromUnknown(
	input: unknown,
): Partial<Record<SVGElementPropKeysType, unknown>> | null {
	if (input == null) {
		return null
	}

	if (typeof input === "object" && !Array.isArray(input)) {
		return svgPropertiesNoEvents(input as Record<PropertyKey, unknown>)
	}

	return null
}
