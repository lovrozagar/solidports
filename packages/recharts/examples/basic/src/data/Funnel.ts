/*
 * Verbatim funnel sample data lifted from upstream recharts storybook.
 * Source: recharts@3.8.1 storybook/stories/API/chart/FunnelChart.stories.tsx (API.args.data)
 * License: MIT (c) recharts contributors. See ../../../../LICENSE.
 */
export type FunnelDatum = {
	fill: string
	name: string
	value: number
}

export const funnelData: FunnelDatum[] = [
	{ fill: "#EEEEEE", name: "A", value: 1009 },
	{ fill: "#E0E0E0", name: "B", value: 903 },
	{ fill: "#BDBDBD", name: "C", value: 756 },
	{ fill: "#9E9E9E", name: "D", value: 622 },
	{ fill: "#757575", name: "E", value: 602 },
	{ fill: "#424242", name: "F", value: 580 },
]
