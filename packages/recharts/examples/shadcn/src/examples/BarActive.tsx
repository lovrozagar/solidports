import { Bar, BarChart, CartesianGrid, Rectangle, XAxis } from "@solidports/recharts"
import type { Component } from "solid-js"

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

export const BarActive: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={browserData}>
			<CartesianGrid vertical={false} />
			<XAxis
				dataKey="browser"
				tickLine={false}
				tickMargin={10}
				axisLine={false}
				tickFormatter={(value: string) =>
					(config[value as keyof typeof config]?.label ?? value) as string
				}
			/>
			<ChartTooltip
				cursor={false}
				content={(p) => <ChartTooltipContent {...p} hideLabel />}
			/>
			<Bar
				dataKey="visitors"
				radius={8}
				shape={(p) =>
					p.index === 2 ? (
						<Rectangle
							{...p}
							fillOpacity={0.8}
							stroke={p.fill}
							strokeDasharray="4"
							strokeDashoffset="4"
						/>
					) : (
						<Rectangle {...p} />
					)
				}
			/>
		</BarChart>
	</ChartContainer>
)
