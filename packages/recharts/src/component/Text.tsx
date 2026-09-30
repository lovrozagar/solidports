/* eslint-disable import/no-cycle */
import { createMemo, For, Show, type JSX } from "solid-js"

import { clsx } from "clsx"
import { isNullish, isNumber, isNumOrStr } from "../util/DataUtils"
import { Global } from "../util/Global"
import { getStringSize } from "../util/DOMUtils"
import { reduceCSSCalc } from "../util/ReduceCSSCalc"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import { resolveDefaultProps } from "../util/resolveDefaultProps"
import { isWellBehavedNumber } from "../util/isWellBehavedNumber"

const BREAKING_SPACES = /[ \f\n\r\t\v\u2028\u2029]+/

interface Words {
	words: Array<string>
	width: number | undefined
}

interface WordsWithWidth {
	words: Array<string>
	width: number
}

interface WordWithComputedWidth {
	word: string
	width: number
}

interface CalculatedWordWidths {
	wordsWithComputedWidth: Array<WordWithComputedWidth>
	spaceWidth: number
}

type CalculateWordWidthsParam = Pick<Props, "children" | "breakAll" | "style">

const calculateWordWidths = (param: CalculateWordWidthsParam): CalculatedWordWidths | null => {
	try {
		let words: string[] = []
		if (!isNullish(param.children)) {
			if (param.breakAll) {
				words = param.children.toString().split("")
			} else {
				words = param.children.toString().split(BREAKING_SPACES)
			}
		}

		const wordsWithComputedWidth = words.map((word) => ({
			width: getStringSize(word, param.style).width,
			word,
		}))

		const spaceWidth = param.breakAll ? 0 : getStringSize("\u00A0", param.style).width

		return { spaceWidth, wordsWithComputedWidth }
	} catch {
		return null
	}
}

/**
 * @inline
 */
export type TextAnchor = "start" | "middle" | "end" | "inherit"

export function isValidTextAnchor(value: string | undefined): value is TextAnchor {
	return value === "start" || value === "middle" || value === "end" || value === "inherit"
}

/**
 * @inline
 */
export type TextVerticalAnchor = "start" | "middle" | "end"

/**
 * @inline
 */
export type RenderableText = string | number | boolean | null | undefined

export function isRenderableText(val: unknown): val is RenderableText {
	return (
		isNullish(val) || typeof val === "string" || typeof val === "number" || typeof val === "boolean"
	)
}

interface TextProps {
	/**
	 * When true, scales the text to fit within the specified width.
	 * The text will be scaled down proportionally to fit the available space.
	 *
	 * **Important interactions:**
	 * - Requires `width` to be defined to have any effect. If width is undefined, scaleToFit does nothing.
	 * - When enabled, `maxLines` restrictions are bypassed and ellipsis truncation is disabled.
	 * - Uses the first line's width to calculate the scale factor.
	 * - The scaling transform is applied as `scale(width / lineWidth)`.
	 *
	 * @defaultValue false
	 */
	scaleToFit?: boolean

	/**
	 * Text rotation angle in degrees.
	 * Positive values rotate clockwise, negative values rotate counterclockwise.
	 *
	 * @defaultValue 0
	 */
	angle?: number

	/**
	 * Horizontal text alignment within the text element.
	 * - 'start': Text starts at the x coordinate (left-aligned for LTR text)
	 * - 'middle': Text is centered on the x coordinate
	 * - 'end': Text ends at the x coordinate (right-aligned for LTR text)
	 * - 'inherit': Inherits the text-anchor from parent element
	 *
	 * **Note:** This controls horizontal alignment only and does not affect RTL text behavior.
	 * @defaultValue 'start'
	 */
	textAnchor?: TextAnchor

	/**
	 * Vertical text alignment relative to the y coordinate.
	 * - 'start': Text baseline starts at y coordinate (text appears below the y position)
	 * - 'middle': Text is vertically centered on the y coordinate
	 * - 'end': Text baseline ends at y coordinate (text appears above the y position)
	 *
	 * **Note:** This controls vertical positioning only and does not affect RTL (right-to-left) text behavior.
	 * The alignment calculation uses capHeight and lineHeight to determine the starting dy offset.
	 *
	 * @defaultValue 'end'
	 */
	verticalAnchor?: TextVerticalAnchor

	/**
	 * CSS styles to apply to the text element.
	 * These styles are used for text measurement calculations when width constraints or scaleToFit are used.
	 * Font-related properties (fontSize, fontFamily, fontWeight, etc.) are particularly important for accurate measurements.
	 */
	style?: JSX.CSSProperties

	/**
	 * Line height for multi-line text.
	 * Can be a number (height in pixels) or a string with CSS units.
	 * Used to calculate spacing between lines when text wraps to multiple lines.
	 * Also used in verticalAnchor calculations for positioning the text block.
	 * @defaultValue '1em'
	 */
	lineHeight?: number | string

	/**
	 * When true, enables character-level breaking instead of word-level breaking.
	 * - false: Text breaks at word boundaries (spaces, tabs, etc.)
	 * - true: Text can break between any characters, useful for languages without spaces
	 *
	 * **Note:** Only effective when `width` is defined to enable line breaking.
	 * @defaultValue false
	 */
	breakAll?: boolean

	/**
	 * The text content to render.
	 * Can be a string or number. Numbers will be converted to strings.
	 * undefined or null values will result in no text being rendered.
	 */
	children?: RenderableText

	/**
	 * Maximum number of lines to display when text wrapping is enabled.
	 * When text exceeds this limit, it will be truncated with an ellipsis (...).
	 *
	 * **Important requirements for ellipsis truncation:**
	 * - `width` must be defined (no effect when width is undefined)
	 * - `scaleToFit` must be false (when scaleToFit is true, maxLines is bypassed)
	 * - Text must actually overflow the specified maxLines or width constraints
	 *
	 * **Truncation behavior:**
	 * - Uses binary search to find the optimal truncation point
	 * - Adds ellipsis (...) at the end of the truncated text
	 * - Ensures the truncated text + ellipsis fits within the constraints
	 *
	 * **Interaction with other props:**
	 * - When `scaleToFit` is true, this property is ignored
	 * - Requires `width` to be set for line breaking to occur
	 */
	maxLines?: number
	/**
	 * When width is specified, the text will automatically wrap by calculating the width of text.
	 */
	width?: number | string
}

export type Props = TextProps & {
	x?: number | string
	y?: number | string
	dx?: number
	dy?: number
	className?: string
	fill?: string
	transform?: string
	ref?: SVGTextElement | ((el: SVGTextElement) => void)
	[key: string]: unknown
}

type CalculateWordsByLinesProps = Pick<Props, "maxLines" | "children" | "style" | "breakAll">

const calculate = (
	words: ReadonlyArray<WordWithComputedWidth>,
	lineWidth: number | string | undefined,
	spaceWidth: number,
	scaleToFit: boolean,
): ReadonlyArray<WordsWithWidth> =>
	words.reduce((result: Array<WordsWithWidth>, { word, width }) => {
		const currentLine = result[result.length - 1]

		if (
			currentLine &&
			width != null &&
			(lineWidth == null ||
				scaleToFit ||
				currentLine.width + width + spaceWidth < Number(lineWidth))
		) {
			/* Word can be added to an existing line */
			currentLine.words.push(word)
			currentLine.width += width + spaceWidth
		} else {
			/* Add first word to line or word is too long to scaleToFit on existing line */
			const newLine: WordsWithWidth = { width, words: [word] }
			result.push(newLine)
		}

		return result
	}, [])

const findLongestLine = (words: ReadonlyArray<WordsWithWidth>): WordsWithWidth =>
	words.reduce((a: WordsWithWidth, b: WordsWithWidth) => (a.width > b.width ? a : b))

const suffix = "\u2026"

const checkOverflow = (
	text: string,
	index: number,
	breakAll: TextProps["breakAll"],
	style: TextProps["style"],
	maxLines: number,
	lineWidth: number | string | undefined,
	spaceWidth: number,
	scaleToFit: boolean,
): [boolean, ReadonlyArray<Words>] => {
	const tempText = text.slice(0, index)

	const words = calculateWordWidths({
		breakAll,
		children: tempText + suffix,
		style,
	})

	if (!words) {
		return [false, []]
	}

	const result: ReadonlyArray<WordsWithWidth> = calculate(
		words.wordsWithComputedWidth,
		lineWidth,
		spaceWidth,
		scaleToFit,
	)

	const doesOverflow = result.length > maxLines || findLongestLine(result).width > Number(lineWidth)

	return [doesOverflow, result]
}

const calculateWordsByLines = (
	lineProps: CalculateWordsByLinesProps,
	initialWordsWithComputedWith: ReadonlyArray<WordWithComputedWidth>,
	spaceWidth: number,
	lineWidth: number | string | undefined,
	scaleToFit: boolean,
): ReadonlyArray<Words> => {
	const shouldLimitLines = isNumber(lineProps.maxLines)
	const text = String(lineProps.children)

	const originalResult: ReadonlyArray<WordsWithWidth> = calculate(
		initialWordsWithComputedWith,
		lineWidth,
		spaceWidth,
		scaleToFit,
	)

	if (!shouldLimitLines || scaleToFit) {
		return originalResult
	}

	const overflows =
		originalResult.length > (lineProps.maxLines ?? 0) ||
		findLongestLine(originalResult).width > Number(lineWidth)
	if (!overflows) {
		return originalResult
	}

	let start = 0
	let end = text.length - 1

	let iterations = 0
	let trimmedResult

	while (start <= end && iterations <= text.length - 1) {
		const middle = Math.floor((start + end) / 2)
		const prev = middle - 1

		const [doesPrevOverflow, result] = checkOverflow(
			text,
			prev,
			lineProps.breakAll,
			lineProps.style,
			lineProps.maxLines ?? 0,
			lineWidth,
			spaceWidth,
			scaleToFit,
		)
		const [doesMiddleOverflow] = checkOverflow(
			text,
			middle,
			lineProps.breakAll,
			lineProps.style,
			lineProps.maxLines ?? 0,
			lineWidth,
			spaceWidth,
			scaleToFit,
		)

		if (!doesPrevOverflow && !doesMiddleOverflow) {
			start = middle + 1
		}

		if (doesPrevOverflow && doesMiddleOverflow) {
			end = middle - 1
		}

		if (!doesPrevOverflow && doesMiddleOverflow) {
			trimmedResult = result
			break
		}

		iterations++
	}

	/* Fallback to originalResult (result without trimming) if we cannot find the
	 * where to trim.  This should not happen :tm: */
	return trimmedResult || originalResult
}

const getWordsWithoutCalculate = (children: RenderableText): Array<Words> => {
	const words = !isNullish(children) ? children.toString().split(BREAKING_SPACES) : []
	return [{ width: undefined, words }]
}

type GetWordsByLinesProps = Pick<
	Props,
	"width" | "scaleToFit" | "children" | "style" | "breakAll" | "maxLines"
>

export const getWordsByLines = (p: GetWordsByLinesProps) => {
	/* Only perform calculations if using features that require them (multiline, scaleToFit) */
	if ((p.width || p.scaleToFit) && !Global.isSsr) {
		let wordsWithComputedWidth: ReadonlyArray<WordWithComputedWidth>
		let spaceWidth: number

		const wordWidths = calculateWordWidths({
			breakAll: p.breakAll,
			children: p.children,
			style: p.style,
		})

		if (wordWidths) {
			const { wordsWithComputedWidth: wcw, spaceWidth: sw } = wordWidths

			wordsWithComputedWidth = wcw
			spaceWidth = sw
		} else {
			return getWordsWithoutCalculate(p.children)
		}

		return calculateWordsByLines(
			{ breakAll: p.breakAll, children: p.children, maxLines: p.maxLines, style: p.style },
			wordsWithComputedWidth,
			spaceWidth,
			p.width,
			Boolean(p.scaleToFit),
		)
	}
	return getWordsWithoutCalculate(p.children)
}

const DEFAULT_FILL = "#808080"

export const textDefaultProps = {
	angle: 0,
	breakAll: false,
	/* Magic number from d3 */
	capHeight: "0.71em",
	fill: DEFAULT_FILL,
	lineHeight: "1em",
	scaleToFit: false,
	textAnchor: "start",
	/* Maintain compat with existing charts / default SVG behavior */
	verticalAnchor: "end",
	x: 0,
	y: 0,
} as const satisfies Partial<Props>

export function Text(outsideProps: Props) {
	const resolved = resolveDefaultProps(outsideProps, textDefaultProps)

	const wordsByLines = createMemo((): ReadonlyArray<Words> => {
		return getWordsByLines({
			breakAll: resolved.breakAll as boolean | undefined,
			children: resolved.children as RenderableText,
			maxLines: resolved.maxLines as number | undefined,
			scaleToFit: resolved.scaleToFit as boolean | undefined,
			style: resolved.style as JSX.CSSProperties | undefined,
			width: resolved.width as number | string | undefined,
		})
	})

	const propsX = () => resolved.x
	const propsY = () => resolved.y
	const lineHeight = () => resolved.lineHeight
	const capHeight = () => resolved.capHeight
	const fill = () => resolved.fill
	const scaleToFit = () => resolved.scaleToFit
	const textAnchor = () => resolved.textAnchor as string
	const verticalAnchor = () => resolved.verticalAnchor

	return (
		<Show when={isNumOrStr(propsX()) && isNumOrStr(propsY()) && wordsByLines().length > 0}>
			{(() => {
				const x = () => Number(propsX()) + (isNumber(resolved.dx) ? resolved.dx : 0)
				const y = () => Number(propsY()) + (isNumber(resolved.dy) ? resolved.dy : 0)

				return (
					<Show when={isWellBehavedNumber(x()) && isWellBehavedNumber(y())}>
						{(() => {
							const startDy = createMemo(() => {
								const lines = wordsByLines()
								switch (verticalAnchor()) {
									case "start":
										return reduceCSSCalc(`calc(${capHeight()})`)
									case "middle":
										return reduceCSSCalc(
											`calc(${(lines.length - 1) / 2} * -${lineHeight()} + (${capHeight()} / 2))`,
										)
									default:
										return reduceCSSCalc(`calc(${lines.length - 1} * -${lineHeight()})`)
								}
							})

							const computedTransform = createMemo(() => {
								const transforms: string[] = []
								const lines = wordsByLines()
								const firstLine = lines[0]
								if (scaleToFit() && firstLine != null) {
									const lineWidth = firstLine.width
									const w = resolved.width
									transforms.push(
										`scale(${isNumber(w) && isNumber(lineWidth) ? Number(w) / lineWidth : 1})`,
									)
								}
								if (resolved.angle) {
									transforms.push(`rotate(${resolved.angle}, ${x()}, ${y()})`)
								}
								return transforms.length ? transforms.join(" ") : undefined
							})

							const filteredProps = () => {
								/* `width` MUST stay on textProps — upstream forwards it as the SVG attr,
								   tests assert `toHaveAttribute("width", "78")`. dx/dy/angle/className/
								   breakAll/maxLines/scaleToFit/style/children/x/y/lineHeight/verticalAnchor/
								   textAnchor/capHeight/fill/ref are handled separately. */
								const {
									dx: _dx,
									dy: _dy,
									angle: _angle,
									className: _cn,
									breakAll: _ba,
									maxLines: _ml,
									scaleToFit: _s,
									children: _children,
									style: _style,
									x: _x,
									y: _y,
									lineHeight: _lh,
									verticalAnchor: _va,
									textAnchor: _ta,
									capHeight: _ch,
									fill: _f,
									ref: _ref,
									...rest
								} = resolved
								return svgPropertiesAndEvents(rest as Record<PropertyKey, unknown>)
							}

							return (
								<text
									{...filteredProps()}
									ref={resolved.ref as ((el: SVGTextElement) => void) | undefined}
									x={x()}
									y={y()}
									class={clsx("recharts-text", resolved.className as string | undefined)}
									text-anchor={textAnchor() as "start" | "middle" | "end" | "inherit"}
									fill={(fill() as string).includes("url") ? DEFAULT_FILL : (fill() as string)}
									transform={computedTransform()}
								>
									<For each={wordsByLines() as Words[]}>
										{(line, index) => {
											const words = () => line.words.join(resolved.breakAll ? "" : " ")
											return (
												<tspan
													x={x()}
													dy={index() === 0 ? startDy() : (lineHeight() as string | number)}
												>
													{words()}
												</tspan>
											)
										}}
									</For>
								</text>
							)
						})()}
					</Show>
				)
			})()}
		</Show>
	)
}

Text.displayName = "Text"
