export type StockPrice = {
	date: string
	openClose: [number, number]
	high: number
	low: number
}

const stockData: ReadonlyArray<StockPrice> = [
	{
		date: "2023-02-01",
		high: 24.95,
		low: 22.36,
		openClose: [22.86, 24.39],
	},
	{
		date: "2023-02-02",
		high: 27.45,
		low: 25.75,
		openClose: [25.96, 26.91],
	},
	{
		date: "2023-02-03",
		high: 27.14,
		low: 25.11,
		openClose: [25.21, 25.52],
	},
	{
		date: "2023-02-06",
		high: 25.45,
		low: 24.52,
		openClose: [24.85, 24.87],
	},
	{
		date: "2023-02-07",
		high: 26.69,
		low: 24.54,
		openClose: [24.83, 26.41],
	},
	{
		date: "2023-02-08",
		high: 26.3,
		low: 24.81,
		openClose: [26.05, 24.99],
	},
]

export { stockData }
