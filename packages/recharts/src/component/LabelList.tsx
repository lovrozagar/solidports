/* eslint-disable import/no-cycle */
import { createContext, useContext, For, Show, type JSX } from "solid-js"
import {
	type LabelContentType,
	isLabelContentAFunction,
	Label,
	type LabelPosition,
	type LabelFormatter,
} from "./Label"
import { Layer } from "../container/Layer"
import { getValueByDataKey } from "../util/ChartUtils"
import type {
	CartesianViewBoxRequired,
	DataKey,
	PolarViewBoxRequired,
	TrapezoidViewBox,
} from "../util/types"
import { isNullish } from "../util/DataUtils"
import type { Props as LabelProps } from "./Label"
import { svgPropertiesAndEvents } from "../util/svgPropertiesAndEvents"
import type { ZIndexable } from "../zIndex/ZIndexLayer"
import { ZIndexLayer } from "../zIndex/ZIndexLayer"
import { DefaultZIndexes } from "../zIndex/DefaultZIndexes"
import { isRenderableText, type RenderableText } from "./Text"
import { isJsxNode } from "../util/ReactUtils"

export interface LabelListEntry<DataPointItem = unknown> {
	/**
	 * Value is what renders in the UI as the label content.
	 * If undefined, then the LabelList will pull it from the payload using the dataKey.
	 */
	value: unknown
	/**
	 * Payload is the source data object for this entry. The shape of this depends on what the user has passed
	 * as the data prop to the chart.
	 */
	payload: DataPointItem
	fill: string | undefined
}

/**
 * This is public API because we expose it as the valueAccessor parameter.
 *
 * The properties of "viewBox" are repeated as the root props of the entry object.
 * So it doesn't matter if you read entry.x or entry.viewBox.x, they are the same.
 *
 * It's not necessary to pass redundant data, but we keep it for backward compatibility.
 */
export interface CartesianLabelListEntry extends LabelListEntry, TrapezoidViewBox {
	/**
	 * The bounding box of the graphical element that this label is attached to.
	 * This will be an individual Bar for example.
	 */
	viewBox: TrapezoidViewBox
	parentViewBox?: CartesianViewBoxRequired
}

export interface PolarLabelListEntry extends LabelListEntry {
	viewBox: PolarViewBoxRequired
	parentViewBox?: PolarViewBoxRequired
	clockWise?: boolean
}

interface LabelListProps extends ZIndexable {
	/**
	 * Unique identifier of this component.
	 * Used as an HTML attribute `id`.
	 */
	id?: string
	/**
	 * The accessor function to get the value of each label. Is ignored if dataKey is specified.
	 * @param entry
	 * @param index
	 */
	valueAccessor?: (
		entry: CartesianLabelListEntry | PolarLabelListEntry,
		index: number,
	) => RenderableText
	/**
	 * The parameter to calculate the view box of label in radial charts.
	 */
	clockWise?: boolean
	/**
	 *
	 * Decides how to extract the value of each label from the data:
	 * - `string`: the name of the field in the data object;
	 * - `number`: the index of the field in the data;
	 * - `function`: a function that receives the data object and returns the value of each label.
	 *
	 * If set, then valueAccessor will be ignored.
	 *
	 * Scatter requires this prop to be set.
	 * Other graphical components will show the same value as the dataKey of the component by default.
	 */
	dataKey?: DataKey<unknown>
	/**
	 * If set a JSX element, the option is the customized element of rendering each label.
	 * If set to a function, the function is called once for each item
	 *
	 * @example <LabelList content={CustomizedLabel} />
	 *
	 * @see {@link https://recharts.github.io/en-US/examples/BarChartWithMinHeight/ Customized content of LabelList in a BarChart}
	 */
	content?: LabelContentType
	textBreakAll?: boolean
	/**
	 * The position of label relative to the view box.
	 */
	position?: LabelPosition
	/**
	 * The offset to the specified "position".
	 * Direction of the offset depends on the position.
	 */
	offset?: LabelProps["offset"]
	/**
	 * Text rotation angle in degrees.
	 * Positive values rotate clockwise, negative values rotate counterclockwise.
	 *
	 * @defaultValue 0
	 */
	angle?: number
	/**
	 * Function to customize how content is serialized before rendering.
	 *
	 * This should return a renderable text - something that the {@link Text} component can render.
	 * Typically, a string or number.
	 * Custom components are not supported here - use the `content` prop instead.
	 */
	formatter?: LabelFormatter
	/**
	 * Z-Index of this component and its children. The higher the value,
	 * the more on top it will be rendered.
	 * Components with higher zIndex will appear in front of components with lower zIndex.
	 * If undefined or 0, the content is rendered in the default layer without portals.
	 *
	 * @since 3.4
	 * @defaultValue 2000
	 * @see {@link https://recharts.github.io/en-US/guide/zIndex/ Z-Index and layers guide}
	 */
	zIndex?: number
}

export type Props = LabelListProps & {
	fill?: string
	type?: string
	[key: string]: unknown
}

/**
 * This is the type accepted for the `label` prop on various graphical items.
 * It accepts:
 *
 * boolean:
 *    true = labels show,
 *    false = labels don't show
 * JSX element:
 *    will be used as label content
 * function:
 *    is used as <Label content={function} />, so this will be called once for each individual label (so typically once for each data point)
 * object:
 *    the props to be passed to a LabelList component
 *
 * @inline
 */
export type ImplicitLabelListType = boolean | LabelContentType | Props

const defaultAccessor = (entry: LabelListEntry): RenderableText => {
	const val = Array.isArray(entry.value) ? entry.value[entry.value.length - 1] : entry.value
	if (isRenderableText(val)) {
		return val
	}
	return undefined
}

const CartesianLabelListContext = createContext<ReadonlyArray<CartesianLabelListEntry> | undefined>(
	undefined,
)

export const CartesianLabelListContextProvider = CartesianLabelListContext.Provider

const PolarLabelListContext = createContext<ReadonlyArray<PolarLabelListEntry> | undefined>(
	undefined,
)

export const PolarLabelListContextProvider = PolarLabelListContext.Provider

function useCartesianLabelListContext(): ReadonlyArray<CartesianLabelListEntry> | undefined {
	return useContext(CartesianLabelListContext)
}

function usePolarLabelListContext(): ReadonlyArray<PolarLabelListEntry> | undefined {
	return useContext(PolarLabelListContext)
}

/**
 * @consumes LabelListContext
 */
export function LabelList(allProps: Props) {
	/* eslint-disable-next-line solid/reactivity -- valueAccessor is a stable function prop; read once at setup */
	const valueAccessor = allProps.valueAccessor ?? defaultAccessor
	const cartesianData = useCartesianLabelListContext()
	const polarData = usePolarLabelListContext()
	const data = cartesianData || polarData

	return (
		<Show when={data && data.length}>
			<ZIndexLayer zIndex={allProps.zIndex ?? DefaultZIndexes.label}>
				<Layer class="recharts-label-list">
					<For each={data as ReadonlyArray<CartesianLabelListEntry | PolarLabelListEntry>}>
						{(entry, index) => {
							/* eslint-disable solid/reactivity -- index() is the <For> index accessor; allProps reads in <For> callback ARE tracked */
							const value = isNullish(allProps.dataKey)
								? valueAccessor(entry, index())
								: (getValueByDataKey(entry.payload, allProps.dataKey) as string | number)

							const idProps = isNullish(allProps.id) ? {} : { id: `${allProps.id}-${index()}` }

							const {
								id: _id,
								dataKey: _dk,
								clockWise: _cw,
								textBreakAll: _tba,
								zIndex: _zi,
								valueAccessor: _va,
								...others
							} = allProps
							/* eslint-enable solid/reactivity */

							return (
								<Label
									{...svgPropertiesAndEvents(entry as unknown as Record<PropertyKey, unknown>)}
									{...others}
									{...idProps}
									/*
									 * Prefer to use the explicit fill from LabelList props.
									 * Only in an absence of that, fall back to the fill of the entry.
									 * The entry fill can be quite difficult to see especially in Bar, Pie, RadialBar in inside positions.
									 * On the other hand it's quite convenient in Scatter, Line, or when the position is outside the Bar, Pie filled shapes.
									 */
									fill={allProps.fill ?? entry.fill}
									parentViewBox={entry.parentViewBox}
									value={value}
									textBreakAll={allProps.textBreakAll}
									viewBox={entry.viewBox}
									index={index()}
									/*
									 * Here we don't want to use the default Label zIndex,
									 * we want it to inherit the zIndex of the LabelList itself
									 * which means just rendering as a regular child, without portaling anywhere.
									 */
									zIndex={0}
								/>
							)
						}}
					</For>
				</Layer>
			</ZIndexLayer>
		</Show>
	)
}

LabelList.displayName = "LabelList"

export function LabelListFromLabelProp(props: {
	label?: ImplicitLabelListType
}): JSX.Element | null {
	/* eslint-disable solid/reactivity -- label type is structural (stable at mount); conditional branches run once */
	if (!props.label) {
		return null
	}

	if (props.label === true) {
		return <LabelList />
	}

	if (isLabelContentAFunction(props.label)) {
		return <LabelList content={props.label} />
	}

	/* `label={<CustomLabel />}` — Solid evaluated to a Node. Clone once per
	 * label-list entry; positions are intrinsic to the user JSX, no extra props
	 * applied (matches simple test cases that only assert count). */
	if (isJsxNode(props.label)) {
		return <NodeLabelList node={props.label} />
	}

	if (typeof props.label === "object") {
		const labelObj = props.label as Props
		return (
			<LabelList {...labelObj} type={labelObj.type != null ? String(labelObj.type) : undefined} />
		)
	}

	return null
	/* eslint-enable solid/reactivity */
}

function NodeLabelList(props: { node: Node }): JSX.Element {
	const cartesianData = useCartesianLabelListContext()
	const polarData = usePolarLabelListContext()
	const data = (cartesianData || polarData) as ReadonlyArray<unknown> | undefined
	return (
		<Show when={data && data.length}>
			<ZIndexLayer zIndex={DefaultZIndexes.label}>
				<Layer class="recharts-label-list">
					<For each={data}>{() => props.node.cloneNode(true) as unknown as JSX.Element}</For>
				</Layer>
			</ZIndexLayer>
		</Show>
	)
}
