import { Bar, BarChart, CartesianGrid, XAxis } from "@solidports/recharts"
import { createMemo, createSignal, For } from 'solid-js';
import type { Component } from 'solid-js';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "../lib/chart"
import { dailyData } from "../data"

const config = {
	desktop: { color: "var(--chart-1)", label: "Desktop" },
	mobile: { color: "var(--chart-2)", label: "Mobile" },
	views: { label: "Page Views" },
} satisfies ChartConfig

type SeriesKey = "desktop" | "mobile"

export const BarInteractive: Component = () => {
	const totals = createMemo(() => ({
		desktop: dailyData.reduce((acc, d) => acc + d.desktop, 0),
		mobile: dailyData.reduce((acc, d) => acc + d.mobile, 0),
	}))
	const [active, setActive] = createSignal<SeriesKey>("desktop")
	const series: ReadonlyArray<SeriesKey> = ["desktop", "mobile"]

	return (
		<div class="flex flex-col rounded-xl border border-border bg-card">
			<div class="flex flex-col items-stretch border-b border-border sm:flex-row">
				<div class="flex flex-1 flex-col justify-center gap-1 px-6 py-5">
					<h3 class="text-base font-semibold leading-none">
						Bar Chart — Interactive
					</h3>
					<p class="text-sm text-muted-foreground">
						Showing total visitors for the last 30 days
					</p>
				</div>
				<div class="flex">
					<For each={series}>
						{(key) => (
							<button
								type="button"
								data-active={active() === key}
								onClick={() => setActive(key)}
								class="relative flex flex-1 flex-col justify-center gap-1 border-l border-border px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50"
							>
								<span class="text-xs text-muted-foreground">
									{config[key].label}
								</span>
								<span class="text-lg font-bold leading-none sm:text-2xl">
									{totals()[key].toLocaleString()}
								</span>
							</button>
						)}
					</For>
				</div>
			</div>
			<div class="px-2 pt-4 pb-2 sm:px-6 sm:pt-6">
				<ChartContainer
					config={config}
					class="aspect-auto h-[250px] w-full"
				>
					<BarChart
						data={dailyData}
						margin={{ left: 12, right: 12 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value: string) => {
								const d = new Date(value)
								return d.toLocaleDateString("en-US", {
									day: "numeric",
									month: "short",
								})
							}}
						/>
						<ChartTooltip
							content={(p) => (
								<ChartTooltipContent
									{...p}
									class="w-[150px]"
									nameKey="views"
									labelFormatter={(value) =>
										new Date(value as string).toLocaleDateString("en-US", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})
									}
								/>
							)}
						/>
						<Bar
							dataKey={active()}
							fill={`var(--color-${active()})`}
						/>
					</BarChart>
				</ChartContainer>
			</div>
		</div>
	)
}
