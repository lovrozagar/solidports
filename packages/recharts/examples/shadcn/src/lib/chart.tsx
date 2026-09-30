/*
 * Solid port of shadcn/ui chart wrappers.
 * Mirrors the React shape: ChartContainer / ChartTooltip / ChartTooltipContent /
 * ChartLegend / ChartLegendContent. Theme tokens use CSS vars set at runtime
 * from a ChartConfig map keyed by series.
 */
import {
	Legend,
	type LegendPayload,
	ResponsiveContainer,
	type TooltipContentProps,
	Tooltip,
	type TooltipPayloadEntry,
} from "@solidports/recharts"
import {
	createContext,
	createMemo,
	createUniqueId,
	For,
	type JSX,
	mergeProps,
	Show,
	splitProps,
	useContext,
} from "solid-js"

import { cn } from "./utils"

const THEMES = { dark: ".dark", light: "" } as const

type ChartTheme = keyof typeof THEMES

export type ChartConfig = Record<
	string,
	{
		label?: string
		icon?: (props: { class?: string }) => JSX.Element
	} & ({ color?: string; theme?: never } | { theme: Record<ChartTheme, string>; color?: never })
>

type ChartContextValue = { config: ChartConfig }

const ChartContext = createContext<ChartContextValue | null>(null)

export function useChart(): ChartContextValue {
	const ctx = useContext(ChartContext)
	if (!ctx) throw new Error("useChart must be used inside <ChartContainer />")
	return ctx
}

type ChartContainerProps = {
	id?: string
	class?: string
	config: ChartConfig
	children: JSX.Element
}

export function ChartContainer(props: ChartContainerProps): JSX.Element {
	const uid = createUniqueId()
	const chartId = () => `chart-${(props.id ?? uid).replace(/:/g, "")}`

	const ctx: ChartContextValue = { get config() { return props.config } }

	return (
		<ChartContext.Provider value={ctx}>
			<div
				data-chart={chartId()}
				class={cn(
					"flex aspect-video justify-center text-xs",
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
					"[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
					"[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
					"[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border",
					"[&_.recharts-radial-bar-background-sector]:fill-muted",
					"[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted",
					"[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
					"[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
					"[&_.recharts-sector]:outline-none",
					"[&_.recharts-surface]:outline-none",
					props.class,
				)}
			>
				<ChartStyle id={chartId()} config={props.config} />
				<ResponsiveContainer>{props.children}</ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	)
}

function ChartStyle(props: { id: string; config: ChartConfig }): JSX.Element {
	const colorEntries = createMemo(() =>
		Object.entries(props.config).filter(
			([, v]) => v.theme || ("color" in v && v.color),
		),
	)

	return (
		<Show when={colorEntries().length > 0}>
			<style>
				{Object.entries(THEMES)
					.map(([theme, prefix]) => {
						const lines = colorEntries()
							.map(([key, item]) => {
								let c: string | undefined
								if ("theme" in item && item.theme) {
									c = item.theme[theme as ChartTheme]
								} else if ("color" in item) {
									c = item.color
								}
								return c ? `  --color-${key}: ${c};` : null
							})
							.filter(Boolean)
							.join("\n")
						return `${prefix} [data-chart=${props.id}] {\n${lines}\n}`
					})
					.join("\n")}
			</style>
		</Show>
	)
}

/* Tooltip wrapper — re-exports recharts Tooltip directly. */
export const ChartTooltip = Tooltip

/* Helpers shared by ChartTooltipContent. */
function getPayloadConfigFromPayload(
	config: ChartConfig,
	payload: TooltipPayloadEntry,
	key: string,
): ChartConfig[string] | undefined {
	const inner = (payload as { payload?: unknown }).payload
	const labelKey =
		(payload as { dataKey?: string; name?: string }).dataKey ??
		(payload as { dataKey?: string; name?: string }).name ??
		key
	if (typeof labelKey === "string" && labelKey in config) {
		return config[labelKey]
	}
	if (
		inner &&
		typeof inner === "object" &&
		key in (inner as Record<string, unknown>)
	) {
		const ck = (inner as Record<string, unknown>)[key]
		if (typeof ck === "string" && ck in config) return config[ck]
	}
	return config[key as keyof typeof config]
}

type IndicatorKind = "line" | "dot" | "dashed"

type ChartTooltipContentProps = Partial<TooltipContentProps> & {
	class?: string
	hideLabel?: boolean
	hideIndicator?: boolean
	indicator?: IndicatorKind
	nameKey?: string
	labelKey?: string
	color?: string
	labelClass?: string
}

export function ChartTooltipContent(rawProps: ChartTooltipContentProps): JSX.Element {
	const props = mergeProps(
		{ hideIndicator: false, hideLabel: false, indicator: "dot" as IndicatorKind },
		rawProps,
	)
	const { config } = useChart()

	const tooltipLabel = createMemo<JSX.Element>(() => {
		if (props.hideLabel || !props.payload || props.payload.length === 0) return null
		const item = props.payload[0]
		if (!item) return null
		const key = props.labelKey ?? (typeof props.label === "string" ? props.label : "value")
		const itemConfig = getPayloadConfigFromPayload(config, item, key)
		const value =
			!props.labelKey && typeof props.label === "string"
				? config[props.label as keyof typeof config]?.label ?? props.label
				: itemConfig?.label
		if (props.labelFormatter) {
			return (
				<div class={cn("font-medium", props.labelClass)}>
					{props.labelFormatter(value, props.payload)}
				</div>
			)
		}
		if (value == null) return null
		return <div class={cn("font-medium", props.labelClass)}>{value as JSX.Element}</div>
	})

	const nestLabel = () => (props.payload?.length ?? 0) === 1 && props.indicator !== "dot"

	return (
		<Show when={props.active && props.payload && props.payload.length > 0}>
			<div
				class={cn(
					"grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
					props.class,
				)}
			>
				<Show when={!nestLabel()}>{tooltipLabel()}</Show>
				<div class="grid gap-1.5">
					<For each={props.payload as ReadonlyArray<TooltipPayloadEntry>}>
						{(item, i) => {
							const key = props.nameKey ?? (item.name as string | undefined) ?? (item.dataKey as string | undefined) ?? "value"
							const itemConfig = getPayloadConfigFromPayload(config, item, String(key))
							const indicatorColor =
								props.color ??
								(item.payload as { fill?: string } | undefined)?.fill ??
								(item.color as string | undefined)
							return (
								<div
									class={cn(
										"flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
										props.indicator === "dot" && "items-center",
									)}
								>
									{props.formatter && item.value !== undefined && item.name
										? (props.formatter(
												item.value,
												item.name,
												item,
												i(),
												item.payload,
											) as JSX.Element)
										: (
											<>
												<Show when={itemConfig?.icon}>
													{(() => {
														const Icon = itemConfig?.icon
														return Icon ? <Icon /> : null
													})()}
												</Show>
												<Show
													when={!itemConfig?.icon && !props.hideIndicator}
												>
													<div
														class={cn(
															"shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
															{
																"h-2.5 w-2.5": props.indicator === "dot",
																"my-0.5": nestLabel() && props.indicator === "dashed",
																"w-0 border-[1.5px] border-dashed bg-transparent":
																	props.indicator === "dashed",
																"w-1": props.indicator === "line",
															},
														)}
														style={{
															"--color-bg": indicatorColor,
															"--color-border": indicatorColor,
														}}
													/>
												</Show>
												<div
													class={cn(
														"flex flex-1 justify-between leading-none",
														nestLabel() ? "items-end" : "items-center",
													)}
												>
													<div class="grid gap-1.5">
														<Show when={nestLabel()}>{tooltipLabel()}</Show>
														<span class="text-muted-foreground">
															{(itemConfig?.label as JSX.Element) ?? (item.name as JSX.Element)}
														</span>
													</div>
													<Show when={item.value !== undefined && item.value !== null}>
														<span class="text-foreground font-mono font-medium tabular-nums">
															{typeof item.value === "number"
																? item.value.toLocaleString()
																: (item.value as JSX.Element)}
														</span>
													</Show>
												</div>
											</>
										)}
								</div>
							)
						}}
					</For>
				</div>
			</div>
		</Show>
	)
}

/* Legend wrapper. */
export const ChartLegend = Legend

type ChartLegendContentProps = {
	class?: string
	hideIcon?: boolean
	verticalAlign?: "top" | "middle" | "bottom"
	nameKey?: string
	payload?: ReadonlyArray<LegendPayload>
}

export function ChartLegendContent(props: ChartLegendContentProps): JSX.Element {
	const { config } = useChart()
	const items = () => props.payload ?? []

	return (
		<Show when={items().length > 0}>
			<div
				class={cn(
					"flex items-center justify-center gap-4",
					props.verticalAlign === "top" ? "pb-3" : "pt-3",
					props.class,
				)}
			>
				<For each={items()}>
					{(item) => {
						const dk = (item as { dataKey?: unknown }).dataKey
						const key = props.nameKey ?? (typeof dk === "string" ? dk : undefined) ?? "value"
						const itemConfig =
							typeof key === "string" && key in config ? config[key] : undefined
						return (
							<div class="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground">
								<Show
									when={itemConfig?.icon}
									fallback={
										<Show when={!props.hideIcon}>
											<div
												class="h-2 w-2 shrink-0 rounded-[2px]"
												style={{ background: item.color }}
											/>
										</Show>
									}
								>
									{(() => {
										const Icon = itemConfig?.icon
										return Icon ? <Icon /> : null
									})()}
								</Show>
								<span>{(itemConfig?.label as JSX.Element) ?? (item.value as JSX.Element)}</span>
							</div>
						)
					}}
				</For>
			</div>
		</Show>
	)
}

/* Convenience helper wrapping splitProps to silence unused warnings if a caller forwards. */
export const __debugSplit = splitProps
