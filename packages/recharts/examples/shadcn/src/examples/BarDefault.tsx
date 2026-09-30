import { Bar, BarChart, CartesianGrid, XAxis } from "@solidports/recharts"
import type { Component } from "solid-js"

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

export const BarDefault: Component = () => (
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
				content={(p) => <ChartTooltipContent {...p} hideLabel />}
			/>
			<Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
		</BarChart>
	</ChartContainer>
)
