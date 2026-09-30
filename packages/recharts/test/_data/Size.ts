const sizeData = [
	{
		children: [
			{
				children: [
					{ name: "AgglomerativeCluster", size: 10 },
					{ name: "CommunityStructure", size: 20 },
					{ name: "HierarchicalCluster", size: 30 },
					{ name: "MergeEdge", size: 40 },
				],
				name: "cluster",
			},
			{
				children: [{ name: "AspectRatioBanker", size: 100 }],
				name: "optimization",
			},
		],
		name: "analytics",
	},
	{
		children: [{ name: "DragForce", size: 200 }],
		name: "physics",
	},
]

const treemapData = [
	{
		children: [
			{ name: "Axes", size: 1302 },
			{ name: "Axis", size: 24593 },
			{ name: "AxisGridLine", size: 652 },
			{ name: "AxisLabel", size: 636 },
			{ name: "CartesianAxes", size: 6703 },
		],
		name: "axis",
	},
	{
		children: [
			{ name: "AnchorControl", size: 2138 },
			{ name: "ClickControl", size: 3824 },
			{ name: "Control", size: 1353 },
			{ name: "ControlList", size: 4665 },
			{ name: "DragControl", size: 2649 },
			{ name: "ExpandControl", size: 2832 },
			{ name: "HoverControl", size: 4896 },
			{ name: "IControl", size: 763 },
			{ name: "PanZoomControl", size: 5222 },
			{ name: "SelectionControl", size: 7862 },
			{ name: "TooltipControl", size: 8435 },
		],
		name: "controls",
	},
	{
		children: [
			{ name: "Data", size: 20544 },
			{ name: "DataList", size: 19788 },
			{ name: "DataSprite", size: 10349 },
			{ name: "EdgeSprite", size: 3301 },
			{ name: "NodeSprite", size: 19382 },
			{
				children: [
					{ name: "ArrowType", size: 698 },
					{ name: "EdgeRenderer", size: 5569 },
					{ name: "IRenderer", size: 353 },
					{ name: "ShapeRenderer", size: 2247 },
				],
				name: "render",
			},
			{ name: "ScaleBinding", size: 11275 },
			{ name: "Tree", size: 7147 },
			{ name: "TreeBuilder", size: 9930 },
		],
		name: "data",
	},
	{
		children: [
			{ name: "DataEvent", size: 7313 },
			{ name: "SelectionEvent", size: 6880 },
			{ name: "TooltipEvent", size: 3701 },
			{ name: "VisualizationEvent", size: 2117 },
		],
		name: "events",
	},
	{
		children: [
			{ name: "Legend", size: 20859 },
			{ name: "LegendItem", size: 4614 },
			{ name: "LegendRange", size: 10530 },
		],
		name: "legend",
	},
	{
		children: [
			{
				children: [
					{ name: "BifocalDistortion", size: 4461 },
					{ name: "Distortion", size: 6314 },
					{ name: "FisheyeDistortion", size: 3444 },
				],
				name: "distortion",
			},
			{
				children: [
					{ name: "ColorEncoder", size: 3179 },
					{ name: "Encoder", size: 4060 },
					{ name: "PropertyEncoder", size: 4138 },
					{ name: "ShapeEncoder", size: 1690 },
					{ name: "SizeEncoder", size: 1830 },
				],
				name: "encoder",
			},
			{
				children: [
					{ name: "FisheyeTreeFilter", size: 5219 },
					{ name: "GraphDistanceFilter", size: 3165 },
					{ name: "VisibilityFilter", size: 3509 },
				],
				name: "filter",
			},
			{ name: "IOperator", size: 1286 },
			{
				children: [
					{ name: "Labeler", size: 9956 },
					{ name: "RadialLabeler", size: 3899 },
					{ name: "StackedAreaLabeler", size: 3202 },
				],
				name: "label",
			},
			{
				children: [
					{ name: "AxisLayout", size: 6725 },
					{ name: "BundledEdgeRouter", size: 3727 },
					{ name: "CircleLayout", size: 9317 },
					{ name: "CirclePackingLayout", size: 12003 },
					{ name: "DendrogramLayout", size: 4853 },
					{ name: "ForceDirectedLayout", size: 8411 },
					{ name: "IcicleTreeLayout", size: 4864 },
					{ name: "IndentedTreeLayout", size: 3174 },
					{ name: "Layout", size: 7881 },
					{ name: "NodeLinkTreeLayout", size: 12870 },
					{ name: "PieLayout", size: 2728 },
					{ name: "RadialTreeLayout", size: 12348 },
					{ name: "RandomLayout", size: 870 },
					{ name: "StackedAreaLayout", size: 9121 },
					{ name: "TreeMapLayout", size: 9191 },
				],
				name: "layout",
			},
			{ name: "Operator", size: 2490 },
			{ name: "OperatorList", size: 5248 },
			{ name: "OperatorSequence", size: 4190 },
			{ name: "OperatorSwitch", size: 2581 },
			{ name: "SortOperator", size: 2023 },
		],
		name: "operator",
	},
]

export { sizeData, treemapData }
