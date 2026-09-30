/* Example datasets matching shadcn/ui chart docs. */

export type MonthRow = {
	month: string
	desktop: number
	mobile: number
}

export const monthData: ReadonlyArray<MonthRow> = [
	{ desktop: 186, mobile: 80, month: "January" },
	{ desktop: 305, mobile: 200, month: "February" },
	{ desktop: 237, mobile: 120, month: "March" },
	{ desktop: 73, mobile: 190, month: "April" },
	{ desktop: 209, mobile: 130, month: "May" },
	{ desktop: 214, mobile: 140, month: "June" },
]

export type BrowserRow = {
	browser: string
	visitors: number
	fill: string
}

export const browserData: ReadonlyArray<BrowserRow> = [
	{ browser: "chrome", fill: "var(--color-chrome)", visitors: 275 },
	{ browser: "safari", fill: "var(--color-safari)", visitors: 200 },
	{ browser: "firefox", fill: "var(--color-firefox)", visitors: 187 },
	{ browser: "edge", fill: "var(--color-edge)", visitors: 173 },
	{ browser: "other", fill: "var(--color-other)", visitors: 90 },
]

export type NegativeRow = {
	month: string
	visitors: number
}

export const negativeData: ReadonlyArray<NegativeRow> = [
	{ month: "January", visitors: 186 },
	{ month: "February", visitors: 205 },
	{ month: "March", visitors: -207 },
	{ month: "April", visitors: 173 },
	{ month: "May", visitors: -209 },
	{ month: "June", visitors: 214 },
]

export type DailyRow = {
	date: string
	desktop: number
	mobile: number
}

/* 30-day series for the interactive variant. */
export const dailyData: ReadonlyArray<DailyRow> = Array.from({ length: 30 }, (_, idx) => {
	const day = idx + 1
	const seed = (n: number, salt: number) =>
		Math.abs(Math.sin((n + 1) * 31 + salt) * 10_000) % 1
	return {
		date: `2024-04-${String(day).padStart(2, "0")}`,
		desktop: 100 + Math.floor(seed(idx, 7) * 350),
		mobile: 80 + Math.floor(seed(idx, 19) * 280),
	}
})
