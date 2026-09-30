/* eslint-disable import/no-cycle, sort-keys */
import { For, mergeProps, Show, type JSX } from "solid-js"

import { clsx } from "clsx"
import { Surface } from "../container/Surface"
import { Symbols } from "../shape/Symbols"
import type {
	DataKey,
	LegendType,
	PresentationAttributesAdaptChildEvent,
	CartesianLayout,
	SymbolType,
} from "../util/types"
import { adaptEventsOfChild } from "../util/types"
import type { RequiresDefaultProps } from "../util/resolveDefaultProps"

const SIZE = 32
export type ContentType = JSX.Element | ((props: Props) => JSX.Element)

export type HorizontalAlignmentType = "center" | "left" | "right"
export type VerticalAlignmentType = "top" | "bottom" | "middle"
export type Formatter = (value: unknown, entry: LegendPayload, index: number) => JSX.Element

export interface LegendPayload {
	/**
	 * This is the text that will be displayed in the legend in the DOM.
	 * If undefined, the text will not be displayed, so the icon will be rendered without text.
	 */
	value: string | undefined
	type?: LegendType
	color?: string
	/**
	 * Different graphical items put different information in the payload object
	 * so double check in runtime what are you getting here.
	 */
	payload?: object
	formatter?: Formatter
	inactive?: boolean
	legendIcon?: JSX.Element
	dataKey?: DataKey<unknown>
}

interface DefaultLegendContentProps {
	/**
	 * The size of icon in each legend item.
	 * @defaultValue 14
	 */
	iconSize?: number
	/**
	 * The type of icon in each legend item.
	 */
	iconType?: LegendType
	/**
	 * The layout of legend items inside the legend container.
	 * @defaultValue horizontal
	 */
	layout?: CartesianLayout
	/**
	 * Horizontal alignment of the whole Legend container:
	 *
	 * - `left`: shows the Legend to the left of the chart, and chart width reduces automatically to make space for it.
	 * - `right` shows the Legend to the right of the chart, and chart width reduces automatically.
	 * - `center` shows the Legend in the middle of chart, and chart width remains unchanged.
	 *
	 * The exact behavior changes depending on 'verticalAlign' prop.
	 *
	 * @defaultValue center
	 */
	align?: HorizontalAlignmentType
	/**
	 * Vertical alignment of the whole Legend container:
	 *
	 * - `bottom`: shows the Legend below chart, and chart height reduces automatically to make space for it.
	 * - `top`: shows the Legend above chart, and chart height reduces automatically.
	 * - `middle`:  shows the Legend in the middle of chart, covering other content, and chart height remains unchanged.
	 * The exact behavior changes depending on `align` prop.
	 *
	 * @defaultValue middle
	 */
	verticalAlign?: VerticalAlignmentType
	/**
	 * The color of the icon when the item is inactive.
	 * @defaultValue #ccc
	 */
	inactiveColor?: string
	/**
	 * Function to customize how content is serialized before rendering.
	 *
	 * This should return HTML elements, or strings.
	 *
	 * @example (value, entry, index) => <span style={{ color: 'red' }}>{value}</span>
	 * @example https://codesandbox.io/s/legend-formatter-rmzp9
	 */
	formatter?: Formatter
	/**
	 * The customized event handler of mouseenter on the items in this group
	 * @example https://recharts.github.io/examples/LegendEffectOpacity
	 */
	onMouseEnter?: (data: LegendPayload, index: number, event: MouseEvent) => void
	/**
	 * The customized event handler of mouseleave on the items in this group
	 * @example https://recharts.github.io/examples/LegendEffectOpacity
	 */
	onMouseLeave?: (data: LegendPayload, index: number, event: MouseEvent) => void
	/**
	 * The customized event handler of click on the items in this group
	 */
	onClick?: (data: LegendPayload, index: number, event: MouseEvent) => void
	/**
	 * DefaultLegendContent.payload is omitted from Legend props.
	 * A custom payload can be passed here if desired, or it can be passed from the Legend "content" callback.
	 */
	payload?: ReadonlyArray<LegendPayload>
}

export type Props = DefaultLegendContentProps &
	Omit<PresentationAttributesAdaptChildEvent<unknown, SVGElement>, keyof DefaultLegendContentProps>

const defaultLegendContentDefaultProps = {
	align: "center",
	iconSize: 14,
	inactiveColor: "#ccc",
	layout: "horizontal",
	verticalAlign: "middle",
} as const satisfies Partial<Props>

type InternalProps = RequiresDefaultProps<Props, typeof defaultLegendContentDefaultProps> & {
	payload: ReadonlyArray<LegendPayload>
}

function getStrokeDasharray(input: unknown): string | undefined {
	if (typeof input === "object" && input !== null && "strokeDasharray" in input) {
		return String(input.strokeDasharray)
	}
	return undefined
}

function Icon(props: {
	data: LegendPayload
	iconType: LegendType | undefined
	inactiveColor: string
}) {
	const halfSize = SIZE / 2
	const sixthSize = SIZE / 6
	const thirdSize = SIZE / 3

	const color = () => (props.data.inactive ? props.inactiveColor : props.data.color)
	const preferredIcon = () => props.iconType ?? props.data.type

	return (
		<Show when={preferredIcon() !== "none"}>
			{(() => {
				const icon = preferredIcon()
				if (icon === "plainline") {
					return (
						<line
							stroke-width={4}
							fill="none"
							stroke={color()}
							stroke-dasharray={getStrokeDasharray(props.data.payload)}
							x1={0}
							y1={halfSize}
							x2={SIZE}
							y2={halfSize}
							class="recharts-legend-icon"
						/>
					)
				}
				if (icon === "line") {
					return (
						<path
							stroke-width={4}
							fill="none"
							stroke={color()}
							d={`M0,${halfSize}h${thirdSize}
            A${sixthSize},${sixthSize},0,1,1,${2 * thirdSize},${halfSize}
            H${SIZE}M${2 * thirdSize},${halfSize}
            A${sixthSize},${sixthSize},0,1,1,${thirdSize},${halfSize}`}
							class="recharts-legend-icon"
						/>
					)
				}
				if (icon === "rect") {
					return (
						<path
							stroke="none"
							fill={color()}
							d={`M0,${SIZE / 8}h${SIZE}v${(SIZE * 3) / 4}h${-SIZE}z`}
							class="recharts-legend-icon"
						/>
					)
				}
				if (props.data.legendIcon != null) {
					return props.data.legendIcon
				}

				const symbolType: SymbolType = icon === "none" || icon == null ? "circle" : icon
				return (
					<Symbols
						fill={color()}
						cx={halfSize}
						cy={halfSize}
						size={SIZE}
						sizeType="diameter"
						type={symbolType}
					/>
				)
			})()}
		</Show>
	)
}

function Items(props: InternalProps) {
	const viewBox = { height: SIZE, width: SIZE, x: 0, y: 0 }
	const itemStyle = () => ({
		display: props.layout === "horizontal" ? "inline-block" : "block",
		"margin-right": "10px",
	})
	const svgStyle: JSX.CSSProperties = {
		display: "inline-block",
		"margin-right": "4px",
		"vertical-align": "middle",
	}

	return (
		<For each={props.payload as LegendPayload[]}>
			{(entry, i) => {
				const finalFormatter = () => entry.formatter || props.formatter
				const className = () =>
					clsx({
						"recharts-legend-item": true,
						[`legend-item-${i()}`]: true,
						inactive: entry.inactive,
					})

				return (
					<Show when={entry.type !== "none"}>
						{(() => {
							const color = () => (entry.inactive ? props.inactiveColor : entry.color)
							const finalValue = () => {
								const fmt = finalFormatter()
								return fmt ? fmt(entry.value, entry, i()) : entry.value
							}

							return (
								<li
									class={className()}
									style={itemStyle()}
									{...adaptEventsOfChild(props, entry, i())}
								>
									<Surface
										width={props.iconSize}
										height={props.iconSize}
										viewBox={viewBox}
										style={svgStyle}
										aria-label={`${finalValue()} legend icon`}
									>
										<Icon
											data={entry}
											iconType={props.iconType}
											inactiveColor={props.inactiveColor}
										/>
									</Surface>
									<span class="recharts-legend-item-text" style={{ color: color() }}>
										{finalValue()}
									</span>
								</li>
							)
						})()}
					</Show>
				)
			}}
		</For>
	)
}

/**
 * This component is by default rendered inside the {@link Legend} component. You would not use it directly.
 *
 * You can use this component to customize the content of the legend,
 * or you can provide your own completely independent content.
 */
export const DefaultLegendContent = (outsideProps: Props): JSX.Element => {
	/* mergeProps preserves prop reactivity; do NOT use resolveDefaultProps here — its
	   `{...realProps}` spread enumerates own keys (including `payload`), capturing the
	   initial empty array as a plain value and freezing the early-return / Show predicate
	   to its setup-time evaluation (GOTCHA-002 + GOTCHA-004). */
	const props = mergeProps(defaultLegendContentDefaultProps, outsideProps) as InternalProps

	const finalStyle = (): JSX.CSSProperties => ({
		margin: 0,
		padding: 0,
		"text-align": props.layout === "horizontal" ? props.align : "left",
	})

	return (
		<Show when={props.payload != null && props.payload.length > 0}>
			<ul class="recharts-default-legend" style={finalStyle()}>
				<Items {...props} payload={props.payload ?? []} />
			</ul>
		</Show>
	)
}
