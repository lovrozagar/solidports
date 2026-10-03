const examples = [
	"aggregation",
	"basic-app-table",
	"basic-external-state",
	"basic-use-table",
	"cell-spanning",
	"column-ordering",
	"column-pinning",
	"column-pinning-split",
	"column-pinning-sticky",
	"column-resizing",
	"column-resizing-performant",
	"column-sizing",
	"column-visibility",
	"composable-tables",
	"expanding",
	"filters-faceted-bucketed",
	"grouped-aggregation",
	"grouping",
	"header-groups",
	"kitchen-sink",
	"pagination",
	"row-pinning",
	"row-selection",
	"sorting",
	"sub-components",
];

document.getElementById("source")!.textContent = __TABLE_SOURCE__;
document.getElementById("list")!.append(
	...examples.map((name) => {
		const li = document.createElement("li");
		const a = document.createElement("a");
		a.href = `./examples/${name}/`;
		a.textContent = name;
		li.append(a);
		return li;
	}),
);
