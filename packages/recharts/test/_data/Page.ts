export type PageDataType = {
	name: string
	uv: number
	pv: number
	amt: number
}

export const rangeData = [
	{
		day: "05-01",
		temperature: [-1, 10],
	},
	{
		day: "05-02",
		temperature: [2, 15],
	},
	{
		day: "05-03",
		temperature: [3, 12],
	},
	{
		day: "05-04",
		temperature: [4, 12],
	},
	{
		day: "05-05",
		temperature: [12, 16],
	},
	{
		day: "05-06",
		temperature: [5, 16],
	},
	{
		day: "05-07",
		temperature: [3, 12],
	},
	{
		day: "05-08",
		temperature: [0, 8],
	},
	{
		day: "05-09",
		temperature: [-3, 5],
	},
]

const pageData: PageDataType[] = [
	{
		amt: 1400,
		name: "Page A",
		pv: 800,
		uv: 590,
	},
	{
		amt: 1400,
		name: "Page B",
		pv: 800,
		uv: 590,
	},
	{
		amt: 1506,
		name: "Page C",
		pv: 967,
		uv: 868,
	},
	{
		amt: 989,
		name: "Page D",
		pv: 1098,
		uv: 1397,
	},
	{
		amt: 1228,
		name: "Page E",
		pv: 1200,
		uv: 1480,
	},
	{
		amt: 1100,
		name: "Page F",
		pv: 1108,
		uv: 1520,
	},
	{
		amt: 1700,
		name: "Page G",
		pv: 680,
		uv: 1400,
	},
]

type LogDataType = {
	year: number
	performance: number // in floating point operations per second
}

export const logData: LogDataType[] = [
	{ performance: 1, year: 1970 },
	{ performance: 10, year: 1975 },
	{ performance: 100, year: 1980 },
	{ performance: 1000, year: 1985 },
	{ performance: 10000, year: 1990 },
	{ performance: 100000, year: 1995 },
	{ performance: 1000000, year: 2000 },
	{ performance: 10000000, year: 2005 },
	{ performance: 100000000, year: 2010 },
	{ performance: 1000000000, year: 2015 },
	{ performance: 10000000000, year: 2020 },
]

export const pageDataWithNegativeNumbers: PageDataType[] = [
	{
		amt: 2400,
		name: "Page A",
		pv: 2400,
		uv: 4000,
	},
	{
		amt: 2210,
		name: "Page B",
		pv: 1398,
		uv: -3000,
	},
	{
		amt: 2290,
		name: "Page C",
		pv: -9800,
		uv: -2000,
	},
	{
		amt: 2000,
		name: "Page D",
		pv: 3908,
		uv: 2780,
	},
	{
		amt: 2181,
		name: "Page E",
		pv: 4800,
		uv: -1890,
	},
	{
		amt: 2500,
		name: "Page F",
		pv: -3800,
		uv: 2390,
	},
	{
		amt: 2100,
		name: "Page G",
		pv: 4300,
		uv: 3490,
	},
]

const numberData = [
	{ name: "1", pv: 456, uv: 300 },
	{ name: "2", pv: 230, uv: -145 },
	{ name: "3", pv: 345, uv: -100 },
	{ name: "4", pv: 450, uv: -8 },
	{ name: "5", pv: 321, uv: 100 },
	{ name: "6", pv: 235, uv: 9 },
	{ name: "7", pv: 267, uv: 53 },
	{ name: "8", pv: -378, uv: 252 },
	{ name: "9", pv: -210, uv: 79 },
	{ name: "10", pv: -23, uv: 294 },
	{ name: "12", pv: 45, uv: 43 },
	{ name: "13", pv: 90, uv: -74 },
	{ name: "14", pv: 130, uv: -71 },
	{ name: "15", pv: 11, uv: -117 },
	{ name: "16", pv: 107, uv: -186 },
	{ name: "17", pv: 926, uv: -16 },
	{ name: "18", pv: 653, uv: -125 },
	{ name: "19", pv: 366, uv: 222 },
	{ name: "20", pv: 486, uv: 372 },
	{ name: "21", pv: 512, uv: 182 },
	{ name: "22", pv: 302, uv: 164 },
	{ name: "23", pv: 425, uv: 316 },
	{ name: "24", pv: 467, uv: 131 },
	{ name: "25", pv: -190, uv: 291 },
	{ name: "26", pv: 194, uv: -47 },
	{ name: "27", pv: 371, uv: -415 },
	{ name: "28", pv: 376, uv: -182 },
	{ name: "29", pv: 295, uv: -93 },
	{ name: "30", pv: 322, uv: -99 },
	{ name: "31", pv: 246, uv: -52 },
	{ name: "32", pv: 33, uv: 154 },
	{ name: "33", pv: 354, uv: 205 },
	{ name: "34", pv: 258, uv: 70 },
	{ name: "35", pv: 359, uv: -25 },
	{ name: "36", pv: 192, uv: -59 },
	{ name: "37", pv: 464, uv: -63 },
	{ name: "38", pv: -2, uv: -91 },
	{ name: "39", pv: 154, uv: -66 },
	{ name: "40", pv: 186, uv: -50 },
]

const subjectData = [
	{ A: 120, B: 110, fullMark: 150, subject: "Math" },
	{ A: 98, B: 130, fullMark: 150, subject: "Chinese" },
	{ A: 86, B: 130, fullMark: 150, subject: "English" },
	{ A: 99, B: 100, fullMark: 150, subject: "Geography" },
	{ A: 85, B: 90, fullMark: 150, subject: "Physics" },
	{ A: 65, B: 85, fullMark: 150, subject: "History" },
]

const pageDataWithFillColor = [
	{
		amt: 1400,
		fill: "#8884d8",
		name: "18-24",
		pv: 2400,
		uv: 31.47,
	},
	{
		amt: 720,
		fill: "#83a6ed",
		name: "25-29",
		pv: 4567,
		uv: 26.69,
	},
	{
		amt: 680,
		fill: "#8dd1e1",
		name: "30-34",
		pv: 1398,
		uv: 15.69,
	},
	{
		amt: 1700,
		fill: "#82ca9d",
		name: "35-39",
		pv: 9800,
		uv: 8.22,
	},
	{
		amt: 1500,
		fill: "#a4de6c",
		name: "40-49",
		pv: 3908,
		uv: 8.63,
	},
	{
		amt: 680,
		fill: "#d0ed57",
		name: "50+",
		pv: 4800,
		uv: 2.63,
	},
	{
		amt: 690,
		fill: "#ffc658",
		name: "unknown",
		pv: 4800,
		uv: 6.67,
	},
]

export { pageData, numberData, subjectData, pageDataWithFillColor }
