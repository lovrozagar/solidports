import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "@solidports/recharts"
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
	label: { color: "var(--background)" },
	mobile: { color: "var(--chart-2)", label: "Mobile" },
} satisfies ChartConfig

export const BarCustomLabel: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={monthData} layout="vertical" margin={{ right: 16 }}>
			<CartesianGrid horizontal={false} />
			<YAxis
				dataKey="month"
				type="category"
				tickLine={false}
				tickMargin={10}
				axisLine={false}
				tickFormatter={(value: string) => value.slice(0, 3)}
				hide
			/>
			<XAxis dataKey="desktop" type="number" hide />
			<ChartTooltip
				cursor={false}
				content={(p) => <ChartTooltipContent {...p} indicator="line" />}
			/>
			<Bar dataKey="desktop" fill="var(--color-desktop)" radius={4}>
				<LabelList
					dataKey="month"
					position="insideLeft"
					offset={8}
					class-name="fill-(--color-label)"
					font-size={12}
				/>
				<LabelList
					dataKey="desktop"
					position="right"
					offset={8}
					class-name="fill-foreground"
					font-size={12}
				/>
			</Bar>
		</BarChart>
	</ChartContainer>
)
