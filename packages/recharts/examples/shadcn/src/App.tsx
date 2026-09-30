import type { Component } from "solid-js"
import { For } from "solid-js"

import { BarActive } from "./examples/BarActive"
import { BarCustomLabel } from "./examples/BarCustomLabel"
import { BarDefault } from "./examples/BarDefault"
import { BarHorizontal } from "./examples/BarHorizontal"
import { BarInteractive } from "./examples/BarInteractive"
import { BarMixed } from "./examples/BarMixed"
import { BarMultiple } from "./examples/BarMultiple"
import { BarNegative } from "./examples/BarNegative"
import { BarStacked } from "./examples/BarStacked"
import { BarStackedLegend } from "./examples/BarStackedLegend"

type CardEntry = {
	id: string
	title: string
	description: string
	view: Component
}

const cards: ReadonlyArray<CardEntry> = [
	{
		description: "January – June 2024",
		id: "default",
		title: "Bar Chart",
		view: BarDefault,
	},
	{
		description: "January – June 2024",
		id: "horizontal",
		title: "Bar Chart — Horizontal",
		view: BarHorizontal,
	},
	{
		description: "January – June 2024",
		id: "multiple",
		title: "Bar Chart — Multiple",
		view: BarMultiple,
	},
	{
		description: "January – June 2024",
		id: "stacked",
		title: "Bar Chart — Stacked",
		view: BarStacked,
	},
	{
		description: "January – June 2024",
		id: "stacked-legend",
		title: "Bar Chart — Stacked + Legend",
		view: BarStackedLegend,
	},
	{
		description: "January – June 2024",
		id: "active",
		title: "Bar Chart — Active",
		view: BarActive,
	},
	{
		description: "January – June 2024",
		id: "negative",
		title: "Bar Chart — Negative",
		view: BarNegative,
	},
	{
		description: "January – June 2024",
		id: "custom-label",
		title: "Bar Chart — Custom Label",
		view: BarCustomLabel,
	},
	{
		description: "January – June 2024",
		id: "mixed",
		title: "Bar Chart — Mixed",
		view: BarMixed,
	},
]

export const App: Component = () => (
	<div class="mx-auto max-w-6xl px-6 py-12">
		<header class="mb-10">
			<h1 class="text-3xl font-bold tracking-tight">
				shadcn charts on @solidports/recharts
			</h1>
			<p class="mt-2 text-muted-foreground">
				Solid port of the bar chart variants from ui.shadcn.com/charts.
			</p>
		</header>
		<section class="mb-10">
			<BarInteractive />
		</section>
		<section class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<For each={cards}>
				{(card) => {
					const View = card.view
					return (
						<article class="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
							<header>
								<h2 class="text-base font-semibold leading-none">{card.title}</h2>
								<p class="mt-1 text-sm text-muted-foreground">{card.description}</p>
							</header>
							<div class="flex-1">
								<View />
							</div>
						</article>
					)
				}}
			</For>
		</section>
	</div>
)
