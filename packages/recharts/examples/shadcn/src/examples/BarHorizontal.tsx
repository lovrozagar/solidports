import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "@solidports/recharts"
import type { Component } from 'solid-js';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "../lib/chart"
import { monthData } from "../data"

const config = {
	desktop: { color: "var(--chart-1)", label: "Desktop" },
} satisfies ChartConfig

export const BarHorizontal: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={monthData} layout="vertical" margin={{ left: -20 }}>
			<CartesianGrid horizontal={false} />
			<XAxis type="number" dataKey="desktop" hide />
			<YAxis
				dataKey="month"
				type="category"
				tickLine={false}
				tickMargin={10}
				axisLine={false}
				tickFormatter={(value: string) => value.slice(0, 3)}
			/>
			<ChartTooltip
				cursor={false}
				content={(p) => <ChartTooltipContent {...p} hideLabel />}
			/>
			<Bar dataKey="desktop" fill="var(--color-desktop)" radius={5} />
		</BarChart>
	</ChartContainer>
)
