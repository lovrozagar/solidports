import type { SunburstData } from "../src/chart/SunburstChart"
import type { ChartData } from "../src/state/chartDataSlice"

export const PageData = [
	{ amt: 2400, name: "Page A", pv: 2400, uv: 400 },
	{ amt: 2400, name: "Page B", pv: 4567, uv: 300 },
	{ amt: 2400, name: "Page C", pv: 1398, uv: 300 },
	{ amt: 2400, name: "Page D", pv: 9800, uv: 200 },
	{ amt: 2400, name: "Page E", pv: 3908, uv: 278 },
	{ amt: 2400, name: "Page F", pv: 4800, uv: 189 },
]

export const exampleSankeyData = {
	links: [
		{ source: 0, target: 1, value: 124.729 },
		{ source: 1, target: 2, value: 0.597 },
		{ source: 1, target: 3, value: 26.862 },
		{ source: 1, target: 4, value: 280.322 },
		{ source: 1, target: 5, value: 81.144 },
		{ source: 6, target: 2, value: 35 },
		{ source: 7, target: 4, value: 35 },
		{ source: 8, target: 9, value: 11.606 },
		{ source: 10, target: 9, value: 63.965 },
		{ source: 9, target: 4, value: 75.571 },
		{ source: 11, target: 12, value: 10.639 },
		{ source: 11, target: 13, value: 22.505 },
		{ source: 11, target: 14, value: 46.184 },
		{ source: 15, target: 16, value: 104.453 },
		{ source: 15, target: 14, value: 113.726 },
		{ source: 15, target: 17, value: 27.14 },
		{ source: 15, target: 12, value: 342.165 },
		{ source: 15, target: 18, value: 37.797 },
		{ source: 15, target: 19, value: 4.412 },
		{ source: 15, target: 13, value: 40.858 },
		{ source: 15, target: 3, value: 56.691 },
		{ source: 15, target: 20, value: 7.863 },
		{ source: 15, target: 21, value: 90.008 },
		{ source: 15, target: 22, value: 93.494 },
		{ source: 23, target: 24, value: 40.719 },
		{ source: 25, target: 24, value: 82.233 },
		{ source: 5, target: 13, value: 0.129 },
		{ source: 5, target: 3, value: 1.401 },
		{ source: 5, target: 26, value: 151.891 },
		{ source: 5, target: 19, value: 2.096 },
		{ source: 5, target: 12, value: 48.58 },
		{ source: 27, target: 15, value: 7.013 },
		{ source: 17, target: 28, value: 20.897 },
		{ source: 17, target: 3, value: 6.242 },
		{ source: 28, target: 18, value: 20.897 },
		{ source: 29, target: 15, value: 6.995 },
		{ source: 2, target: 12, value: 121.066 },
		{ source: 2, target: 30, value: 128.69 },
		{ source: 2, target: 18, value: 135.835 },
		{ source: 2, target: 31, value: 14.458 },
		{ source: 2, target: 32, value: 206.267 },
		{ source: 2, target: 19, value: 3.64 },
		{ source: 2, target: 33, value: 33.218 },
		{ source: 2, target: 20, value: 4.413 },
		{ source: 34, target: 1, value: 4.375 },
		{ source: 24, target: 5, value: 122.952 },
		{ source: 35, target: 26, value: 839.978 },
		{ source: 36, target: 37, value: 504.287 },
		{ source: 38, target: 37, value: 107.703 },
		{ source: 37, target: 2, value: 611.99 },
		{ source: 39, target: 4, value: 56.587 },
		{ source: 39, target: 1, value: 77.81 },
		{ source: 40, target: 14, value: 193.026 },
		{ source: 40, target: 13, value: 70.672 },
		{ source: 41, target: 15, value: 59.901 },
		{ source: 42, target: 14, value: 19.263 },
		{ source: 43, target: 42, value: 19.263 },
		{ source: 43, target: 41, value: 59.901 },
		{ source: 4, target: 19, value: 0.882 },
		{ source: 4, target: 26, value: 400.12 },
		{ source: 4, target: 12, value: 46.477 },
		{ source: 26, target: 15, value: 525.531 },
		{ source: 26, target: 3, value: 787.129 },
		{ source: 26, target: 11, value: 79.329 },
		{ source: 44, target: 15, value: 9.452 },
		{ source: 45, target: 1, value: 182.01 },
		{ source: 46, target: 15, value: 19.013 },
		{ source: 47, target: 15, value: 289.366 },
	],
	nodes: [
		{ name: "Agricultural waste" },
		{ name: "Bio-conversion" },
		{ name: "Liquid" },
		{ name: "Losses" },
		{ name: "Solid" },
		{ name: "Gas" },
		{ name: "Biofuel imports" },
		{ name: "Biomass imports" },
		{ name: "Coal imports" },
		{ name: "Coal" },
		{ name: "Coal reserves" },
		{ name: "District heating" },
		{ name: "Industry" },
		{ name: "Heating and cooling - commercial" },
		{ name: "Heating and cooling - homes" },
		{ name: "Electricity grid" },
		{ name: "Over generation / exports" },
		{ name: "H2 conversion" },
		{ name: "Road transport" },
		{ name: "Agriculture" },
		{ name: "Rail transport" },
		{ name: "Lighting & appliances - commercial" },
		{ name: "Lighting & appliances - homes" },
		{ name: "Gas imports" },
		{ name: "Ngas" },
		{ name: "Gas reserves" },
		{ name: "Thermal generation" },
		{ name: "Geothermal" },
		{ name: "H2" },
		{ name: "Hydro" },
		{ name: "International shipping" },
		{ name: "Domestic aviation" },
		{ name: "International aviation" },
		{ name: "National navigation" },
		{ name: "Marine algae" },
		{ name: "Nuclear" },
		{ name: "Oil imports" },
		{ name: "Oil" },
		{ name: "Oil reserves" },
		{ name: "Other waste" },
		{ name: "Pumped heat" },
		{ name: "Solar PV" },
		{ name: "Solar Thermal" },
		{ name: "Solar" },
		{ name: "Tidal" },
		{ name: "UK land based bioenergy" },
		{ name: "Wave" },
		{ name: "Wind" },
	],
}

export const exampleTreemapData = [
	{
		children: [
			{ name: "U", rank: "21", value: 12490887132 },
			{ name: "V", rank: "22", value: 10772738863 },
			{ name: "W", rank: "23", value: 8236223813 },
		],
		name: "A",
		rank: "1",
	},
	{ name: "B", rank: "2", value: 12490887132 },
	{ name: "C", rank: "3", value: 10772738863 },
	{ name: "D", rank: "4", value: 8236223813 },
	{ name: "E", rank: "5", value: 6583448127 },
	{ name: "F", rank: "6", value: 5834718183 },
	{ name: "G", rank: "7", value: 5559852006 },
	{ name: "H", rank: "8", value: 4651272674 },
	{ name: "I", rank: "9", value: 4248844205 },
	{ name: "J", rank: "10", value: 3862568602 },
	{ name: "K", rank: "11", value: 3803070009 },
	{ name: "L", rank: "12", value: 3480361169 },
	{ name: "M", rank: "13", value: 3476552989 },
	{ name: "N", rank: "14", value: 3147229713 },
	{ name: "O", rank: "15", value: 2907504853 },
	{ name: "P", rank: "16", value: 2555558916 },
	{ name: "Q", rank: "17", value: 2149183029 },
	{ name: "R", rank: "18", value: 2107468912 },
	{ name: "S", rank: "19", value: 2088055427 },
	{ name: "T", rank: "20", value: 1885463047 },
]

export const exampleSunburstData: SunburstData = {
	children: [
		{
			children: [
				{
					name: "third child",
					value: 10,
				},
			],
			fill: "#264653",
			name: "Child1",
			value: 30,
		},
		{
			children: [
				{
					name: "another child",
					value: 10,
				},
			],
			fill: "#2a9d8f",
			name: "Child2",
			value: 20,
		},
		{
			fill: "#e9c46a",
			name: "Child3",
			value: 20,
		},
	],
	name: "Root",
	value: 100,
}

export const exampleRadarData = [
	{ half: 210, name: "iPhone 3GS", value: 420 },
	{ half: 230, name: "iPhone 4", value: 460 },
	{ half: 500, name: "iPhone 4s", value: 999 },
	{ half: 250, name: "iPhone 5", value: 500 },
	{ half: 432, name: "iPhone 5s", value: 864 },
	{ half: 325, name: "iPhone 6", value: 650 },
	{ half: 383, name: "iPhone 6s", value: 765 },
	{ half: 183, name: "iPhone 5se", value: 365 },
]

export const misbehavedData: ChartData = [
	{ x: null },
	{ x: "Jan" },
	{ x: undefined },
	{ x: "Feb" },
	{ x: [] },
	{ x: "Mar" },
	{ x: function anon() {} },
	{ x: "Apr" },
	{ x: {} },
	{ x: "May" },
	{ x: NaN },
	{ x: "Jun" },
	{ x: new Map() },
	{ x: "Jul" },
	{ x: Symbol.for("mock symbol") },
	{ x: "Aug" },
	{ x: new Promise(() => {}) },
]

export const boxPlotData = [
	{
		average: 150,
		bottomBox: 50,
		bottomWhisker: 100,
		min: 100,
		size: 150,
		topBox: 200,
		topWhisker: 200,
	},
	{
		average: 550,
		bottomBox: 200,
		bottomWhisker: 200,
		min: 200,
		size: 250,
		topBox: 100,
		topWhisker: 100,
	},
	{
		average: 400,
		bottomBox: 200,
		bottomWhisker: 200,
		min: 0,
		size: 350,
		topBox: 200,
		topWhisker: 200,
	},
]

/**
 * Three Rings for the Elven-kings under the sky,
 * Seven for the Dwarf-lords in their halls of stone,
 * Nine for Mortal Men doomed to die,
 * One for the Dark Lord on his dark throne
 * In the Land of Mordor where the Shadows lie.
 * One Ring to rule them all, One Ring to find them,
 * One Ring to bring them all and in the darkness bind them
 * In the Land of Mordor where the Shadows lie.
 *
 * Lord of the Rings, J.R.R. Tolkien, 1954
 */
export const ringsData = [
	{ fill: "green", name: "Elves", rings: 3 },
	{ fill: "blue", name: "Dwarves", rings: 7 },
	{ fill: "red", name: "Humans", rings: 9 },
	{ fill: "black", name: "Sauron", rings: 1 },
]

export const pageDataWithFillColor = [
	{ fill: "#8884d8", name: "18-24", pv: 2400, uv: 31.47 },
	{ fill: "#83a6ed", name: "25-29", pv: 4567, uv: 26.69 },
	{ fill: "#8dd1e1", name: "30-34", pv: 1398, uv: 15.69 },
	{ fill: "#82ca9d", name: "35-39", pv: 9800, uv: 8.22 },
	{ fill: "#a4de6c", name: "40-49", pv: 3908, uv: 8.63 },
	{ fill: "#d0ed57", name: "50+", pv: 4800, uv: 2.63 },
	{ fill: "#ffc658", name: "unknown", pv: 4800, uv: 6.67 },
]

/**
 * PieChart, and RadialBarChart, have this specialty where they read
 * properties `name` and `fill` and use them for labels and legend colors.
 * Other charts use `nameKey` and `fill` or `stroke` properties.
 */
export const dataWithSpecialNameAndFillProperties = [
	{ fill: "fill1", name: "name1", value: 12 },
	{ fill: "fill2", name: "name2", value: 34 },
	{ fill: "fill3", name: "name3", value: 56 },
	{ fill: "fill4", name: "name4", value: 78 },
]

export const numericalData = [
	{ percent: 10, value: "Luck" },
	{ percent: 20, value: "Skill" },
	{ percent: 15, value: "Concentrated power of will" },
	{ percent: 50, value: "Pleasure" },
	{ percent: 50, value: "Pain" },
	{ percent: 100, value: "Reason to remember the name" },
]

/**
 * Storybook page data used in ClipPath and other visual tests.
 * Different from PageData above -- has 7 entries with different values.
 */
export const pageData = [
	{ amt: 1400, name: "Page A", pv: 800, uv: 590 },
	{ amt: 1400, name: "Page B", pv: 800, uv: 590 },
	{ amt: 1506, name: "Page C", pv: 967, uv: 868 },
	{ amt: 989, name: "Page D", pv: 1098, uv: 1397 },
	{ amt: 1228, name: "Page E", pv: 1200, uv: 1480 },
	{ amt: 1100, name: "Page F", pv: 1108, uv: 1520 },
	{ amt: 1700, name: "Page G", pv: 680, uv: 1400 },
]

export const coordinateWithValueData = [
	{ value: 100, x: 10, y: 50 },
	{ value: 100, x: 150, y: 150 },
	{ value: 100, x: 290, y: 70 },
	{ value: 100, x: 430, y: 60 },
	{ value: 100, x: 570, y: 30 },
]

export const dateWithValueData = [
	{ time: 1483142400000, value: 10 },
	{ time: 1483146000000, value: 20 },
	{ time: 1483147800000, value: 20 },
	{ time: 1483149600000, value: 30 },
	{ time: 1483153200000, value: 10 },
	{ time: 1483155000000, value: 40 },
	{ time: 1483156800000, value: 40 },
	{ time: 1483160400000, value: 20 },
	{ time: 1483164000000, value: 30 },
	{ time: 1483167600000, value: 10 },
	{ time: 1483171200000, value: 60 },
	{ time: 1483173000000, value: 60 },
	{ time: 1483178400000, value: 60 },
]

export const timeData = [
	{ x: new Date("2019-07-04T00:00:00.000Z"), y: 5, z: 7 },
	{ x: new Date("2019-07-05T00:00:00.000Z"), y: 30, z: 7 },
	{ x: new Date("2019-07-06T00:00:00.000Z"), y: 50, z: 12 },
	{ x: new Date("2019-07-07T00:00:00.000Z"), y: 43, z: 35 },
	{ x: new Date("2019-07-08T00:00:00.000Z"), y: 20, z: 14 },
	{ x: new Date("2019-07-09T00:00:00.000Z"), y: -20, z: -10 },
	{ x: new Date("2019-07-10T00:00:00.000Z"), y: 30, z: 53 },
]

export const rangeData = [
	{ day: "05-01", temperature: [-1, 10] },
	{ day: "05-02", temperature: [2, 15] },
	{ day: "05-03", temperature: [3, 12] },
	{ day: "05-04", temperature: [4, 12] },
	{ day: "05-05", temperature: [12, 16] },
	{ day: "05-06", temperature: [5, 16] },
	{ day: "05-07", temperature: [3, 12] },
	{ day: "05-08", temperature: [0, 8] },
	{ day: "05-09", temperature: [-3, 5] },
]
