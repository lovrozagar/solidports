import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "@solidports/recharts"
import type { Component } from 'solid-js';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "../lib/chart"
import { browserData } from "../data"

const config = {
	chrome: { color: "var(--chart-1)", label: "Chrome" },
	edge: { color: "var(--chart-4)", label: "Edge" },
	firefox: { color: "var(--chart-3)", label: "Firefox" },
	other: { color: "var(--chart-5)", label: "Other" },
	safari: { color: "var(--chart-2)", label: "Safari" },
	visitors: { label: "Visitors" },
} satisfies ChartConfig

export const BarMixed: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={browserData} layout="vertical" margin={{ left: 0 }}>
			<CartesianGrid horizontal={false} />
			<YAxis
				dataKey="browser"
				type="category"
				tickLine={false}
				tickMargin={10}
				axisLine={false}
				tickFormatter={(value: string) =>
					(config[value as keyof typeof config]?.label ?? value) as string
				}
			/>
			<XAxis type="number" dataKey="visitors" hide />
			<ChartTooltip
				cursor={false}
				content={(p) => <ChartTooltipContent {...p} />}
			/>
			<Bar dataKey="visitors" radius={5} />
		</BarChart>
	</ChartContainer>
)
