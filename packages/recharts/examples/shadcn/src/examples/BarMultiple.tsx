import { Bar, BarChart, CartesianGrid, XAxis } from "@solidports/recharts"
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
	mobile: { color: "var(--chart-2)", label: "Mobile" },
} satisfies ChartConfig

export const BarMultiple: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={monthData}>
			<CartesianGrid vertical={false} />
			<XAxis
				dataKey="month"
				tickLine={false}
				tickMargin={10}
				axisLine={false}
				tickFormatter={(value: string) => value.slice(0, 3)}
			/>
			<ChartTooltip
				cursor={false}
				content={(p) => <ChartTooltipContent {...p} indicator="dashed" />}
			/>
			<Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
			<Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
		</BarChart>
	</ChartContainer>
)
