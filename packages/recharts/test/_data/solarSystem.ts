type SolarSystemBody = {
	name: string
	orbitalDistanceKm: number
	radiusKm: number
	massKg: number
	fill: string
}

/**
 * Data source: https://solarsystem.nasa.gov/planet-compare/
 *
 * Color fill from: https://astronomy.stackexchange.com/questions/14032/color-of-planets
 * And also some here: https://www.color-hex.com/color-palette/7174
 */
export const solarSystem: Array<SolarSystemBody> = [
	{
		fill: "#ffa700",
		massKg: 1.989e30,
		name: "Sun",
		orbitalDistanceKm: 0,
		radiusKm: 696340,
	},
	{
		fill: "#1a1a1a",
		massKg: 3.3e23,
		name: "Mercury",
		orbitalDistanceKm: 5.791e7,
		radiusKm: 2439.7,
	},
	{
		fill: "#e3bb76",
		massKg: 4.87e24,
		name: "Venus",
		orbitalDistanceKm: 1.082e8,
		radiusKm: 6051.8,
	},
	{
		fill: "#6b93d6",
		massKg: 5.97e24,
		name: "Earth",
		orbitalDistanceKm: 1.496e8,
		radiusKm: 6371,
	},
	{
		fill: "#993d00",
		massKg: 6.42e23,
		name: "Mars",
		orbitalDistanceKm: 2.279e8,
		radiusKm: 3389.5,
	},
	{
		fill: "#b07f35",
		massKg: 1.9e27,
		name: "Jupiter",
		orbitalDistanceKm: 7.786e8,
		radiusKm: 69911,
	},
	{
		fill: "#b08f36",
		massKg: 5.68e26,
		name: "Saturn",
		orbitalDistanceKm: 1.4335e9,
		radiusKm: 58232,
	},
	{
		fill: "#5580aa",
		massKg: 8.68e25,
		name: "Uranus",
		orbitalDistanceKm: 2.8725e9,
		radiusKm: 25362,
	},
	{
		fill: "#366896",
		massKg: 1.02e26,
		name: "Neptune",
		orbitalDistanceKm: 4.4951e9,
		radiusKm: 24622,
	},
	{
		fill: "#968570",
		massKg: 1.3e22,
		name: "Pluto",
		orbitalDistanceKm: 5.9064e9,
		radiusKm: 1188.3,
	},
]
