export type Person = {
	id: string;
	name: string;
	team: string;
	age: number;
	reports?: Array<Person>;
};

export const people: Array<Person> = [
	{
		id: "1",
		name: "Ada",
		team: "core",
		age: 36,
		reports: [
			{ id: "1.1", name: "Bob", team: "core", age: 20 },
			{ id: "1.2", name: "Cy", team: "core", age: 22 },
		],
	},
	{ id: "2", name: "Grace", team: "compiler", age: 85 },
	{ id: "3", name: "Linus", team: "core", age: 54 },
	{ id: "4", name: "Margaret", team: "apollo", age: 33 },
	{ id: "5", name: "Ken", team: "compiler", age: 80 },
	{ id: "6", name: "Barbara", team: "apollo", age: 41 },
];

export function makePeople(count: number): Array<Person> {
	const teams = ["core", "compiler", "apollo", "infra"];
	return Array.from({ length: count }, (_, i) => ({
		id: String(i),
		name: `Person ${i}`,
		team: teams[i % teams.length]!,
		age: 20 + ((i * 7) % 60),
	}));
}
