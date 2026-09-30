import { Bar, BarChart, Cell, CartesianGrid, XAxis } from "@solidports/recharts"
import type { Component } from "solid-js"
import { For } from "solid-js"

import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "../lib/chart"
import { negativeData } from "../data"

const config = {
	visitors: { label: "Visitors" },
} satisfies ChartConfig

export const BarNegative: Component = () => (
	<ChartContainer config={config} class="min-h-[200px] w-full">
		<BarChart data={negativeData}>
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
				content={(p) => <ChartTooltipContent {...p} hideLabel hideIndicator />}
			/>
			<Bar dataKey="visitors">
				<For each={negativeData}>
					{(row) => (
						<Cell
							fill={row.visitors > 0 ? "var(--chart-1)" : "var(--chart-2)"}
						/>
					)}
				</For>
			</Bar>
		</BarChart>
	</ChartContainer>
)
