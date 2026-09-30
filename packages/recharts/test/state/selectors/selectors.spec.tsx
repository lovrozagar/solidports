import { beforeEach, describe, expect, it, test, vi } from "vitest"
import { createEffect } from "solid-js"
import { render } from "@solidjs/testing-library"
import {
	selectActiveCoordinate,
	selectActiveIndex,
	selectIsTooltipActive,
	selectTooltipPayload,
	selectTooltipPayloadConfigurations,
} from "../../../src/state/selectors/selectors"
import { createRechartsStore, RechartsRootState } from "../../../src/state/store"
import { RechartsStoreProvider } from "../../../src/state/RechartsStoreProvider"
import {
	RelativePointer,
	Coordinate,
	PolarCoordinate,
	TooltipEventType,
} from "../../../src/util/types"
import { useAppSelector } from "../../helper/legacyDispatch"
import {
	addTooltipEntrySettings,
	mouseLeaveChart,
	mouseLeaveItem,
	setActiveClickItemIndex,
	setActiveMouseOverItemIndex,
	setMouseClickAxisIndex,
	setMouseOverAxisIndex,
	TooltipIndex,
	TooltipPayload,
	TooltipPayloadConfiguration,
	TooltipPayloadEntry,
} from "../../../src/state/tooltipSlice"
import {
	ChartDataState,
	initialChartDataState,
	setChartData,
	setDataStartEndIndexes,
} from "../../../src/state/chartDataSlice"
import { TooltipTrigger } from "../../../src/chart/types"
import { produceState } from "../../helper/produceState"
import { arrayTooltipSearcher } from "../../../src/state/optionsSlice"
import {
	Area,
	BarChart,
	ComposedChart,
	Line,
	LineChart,
	Pie,
	PieChart,
	Scatter,
} from "../../../src"
import { PageData } from "../../_data"
import { pageData } from "../../_data"
import { mockGetBoundingClientRect } from "../../helper/mockGetBoundingClientRect"
import {
	shouldReturnFromInitialState,
	shouldReturnUndefinedOutOfContext,
	useAppSelectorWithStableTest,
} from "../../helper/selectorTestHelpers"
import { selectActivePropsFromChartPointer } from "../../../src/state/selectors/selectActivePropsFromChartPointer"
import { useTooltipEventType } from "../../../src/state/selectors/selectTooltipEventType"
import { selectTooltipState } from "../../../src/state/selectors/selectTooltipState"
import { combineTooltipPayload } from "../../../src/state/selectors/combiners/combineTooltipPayload"
import { expectLastCalledWith } from "../../helper/expectLastCalledWith"
import { rechartsTestRender } from "../../helper/createSelectorTestCase"
import { noop } from "../../../src/util/DataUtils"

const exampleTooltipPayloadConfiguration1: TooltipPayloadConfiguration = {
	dataDefinedOnItem: [
		[
			{
				dataKey: "x",
				name: "stature",
				payload: {
					x: 100,
					y: 200,
					z: 200,
				},
				unit: "cm",
				value: 100,
			},
			{
				dataKey: "y",
				name: "weight",
				payload: {
					x: 100,
					y: 200,
					z: 200,
				},
				unit: "kg",
				value: 200,
			},
		],
	],
	getPosition: noop,
	settings: {
		color: "color",
		dataKey: "dataKey1",
		fill: "fill",
		graphicalItemId: "graphicalItemId1",
		name: "name is ignored in Scatter in recharts 2.x",
		nameKey: "nameKey1",
	},
}

const exampleTooltipPayloadConfiguration2: TooltipPayloadConfiguration = {
	dataDefinedOnItem: [
		[
			{
				dataKey: "x",
				name: "height",
				payload: {
					x: 100,
					y: 200,
					z: 200,
				},
				unit: "cm",
				value: 100,
			},
			{
				dataKey: "y",
				name: "width",
				payload: {
					x: 10,
					y: 20,
					z: 20,
				},
				unit: "m",
				value: 4,
			},
		],
	],
	getPosition: noop,
	settings: {
		color: "color 2",
		dataKey: "dataKey2",
		fill: "fill 2",
		graphicalItemId: "graphicalItemId2",
		name: "name 2",
		nameKey: "nameKey2",
	},
}

type TestCaseTooltipCombination = { tooltipEventType: TooltipEventType; trigger: TooltipTrigger }
const allTooltipCombinations: ReadonlyArray<TestCaseTooltipCombination> = [
	{ tooltipEventType: "axis", trigger: "hover" },
	{ tooltipEventType: "axis", trigger: "click" },
	{ tooltipEventType: "item", trigger: "hover" },
	{ tooltipEventType: "item", trigger: "click" },
]
const allTooltipEventTypes: ReadonlyArray<TooltipEventType> = ["axis", "item"]

const preloadedState: Partial<RechartsRootState> = {
	options: {
		chartName: "",
		defaultTooltipEventType: "axis",
		eventEmitter: undefined,
		tooltipPayloadSearcher: arrayTooltipSearcher,
	},
}

const activeCoordinate: Coordinate = {
	x: 100,
	y: 200,
}

describe("useTooltipEventType", () => {
	type TooltipEventTypeTestScenario = {
		testName: string
		shared: undefined | boolean
		defaultTooltipEventType: TooltipEventType
		validateTooltipEventTypes: ReadonlyArray<TooltipEventType>
		expected: TooltipEventType
	}

	const testCases: ReadonlyArray<TooltipEventTypeTestScenario> = [
		{
			defaultTooltipEventType: "item",
			expected: "item",
			shared: undefined,
			testName: "default case",
			validateTooltipEventTypes: [],
		},
		{
			defaultTooltipEventType: "item",
			expected: "axis",
			shared: true,
			testName: "shared and axis type is allowed",
			validateTooltipEventTypes: ["axis", "item"],
		},
		{
			defaultTooltipEventType: "item",
			expected: "item",
			shared: true,
			testName: "shared but axis type is not allowed",
			validateTooltipEventTypes: ["item"],
		},
		{
			defaultTooltipEventType: "axis",
			expected: "item",
			shared: false,
			testName: "not shared and item type is allowed",
			validateTooltipEventTypes: ["axis", "item"],
		},
		{
			defaultTooltipEventType: "axis",
			expected: "axis",
			shared: false,
			testName: "not shared but item type is not allowed",
			validateTooltipEventTypes: ["axis"],
		},
	]

	it("should return undefined when outside of Redux context", () => {
		expect.assertions(1)
		const Comp = (): null => {
			const eventType = useTooltipEventType(undefined)
			expect(eventType).toBe(undefined)
			return null
		}
		render(() => <Comp />)
	})

	test.each(testCases)(
		"$testName should return $expected",
		({ shared, defaultTooltipEventType, validateTooltipEventTypes, expected }) => {
			expect.assertions(1)
			const Comp = (): null => {
				const eventType = useTooltipEventType(shared)
				expect(eventType).toBe(expected)
				return null
			}
			const myPreloadedState: Partial<RechartsRootState> = {
				options: {
					chartName: "",
					defaultTooltipEventType,
					eventEmitter: undefined,
					tooltipPayloadSearcher: arrayTooltipSearcher,
					validateTooltipEventTypes,
				},
			}
			render(() => (
				<RechartsStoreProvider preloadedState={myPreloadedState}>
					<Comp />
				</RechartsStoreProvider>
			))
		},
	)
})

describe("selectTooltipPayload", () => {
	it.each(allTooltipCombinations)(
		"should return undefined when outside of Redux context for $tooltipEventType $trigger",
		({ tooltipEventType, trigger }) => {
			expect.assertions(1)
			const Comp = (): null => {
				const payload = useAppSelectorWithStableTest((state) =>
					selectTooltipPayload(state, tooltipEventType, trigger, undefined),
				)
				expect(payload).toBe(undefined)
				return null
			}
			render(() => <Comp />)
		},
	)

	it.each(allTooltipCombinations)(
		"initial state should return undefined for $tooltipEventType $trigger",
		({ tooltipEventType, trigger }) => {
			const [store, setStore] = createRechartsStore()
			expect(selectTooltipPayload(store, tooltipEventType, trigger, undefined)).toEqual(undefined)
		},
	)

	it("should return settings and data from axis hover, if activeIndex is set for the item", () => {
		const [store, setStore] = createRechartsStore(preloadedState)
		const tooltipSettings1: TooltipPayloadConfiguration = {
			dataDefinedOnItem: undefined,
			getPosition: noop,
			settings: { graphicalItemId: "graphicalItemId1", nameKey: "y" },
		}
		const expectedEntry1: TooltipPayloadEntry = {
			dataKey: undefined,
			graphicalItemId: "graphicalItemId1",
			name: undefined,
			nameKey: "y",
			payload: undefined,
			value: undefined,
		}
		const tooltipSettings2: TooltipPayloadConfiguration = {
			dataDefinedOnItem: [
				{ x: 8, y: 9 },
				{ x: 10, y: 11 },
			],
			getPosition: noop,
			settings: {
				dataKey: "x",
				fill: "green",
				graphicalItemId: "graphicalItemId2",
				name: "foo",
				nameKey: "y",
				stroke: "red",
				unit: "bar",
			},
		}
		const expectedEntry2: TooltipPayloadEntry = {
			dataKey: "x",
			fill: "green",
			graphicalItemId: "graphicalItemId2",
			name: 11,
			nameKey: "y",
			payload: { x: 10, y: 11 },
			stroke: "red",
			unit: "bar",
			value: 10,
		}
		addTooltipEntrySettings(tooltipSettings1)(setStore, store)
		addTooltipEntrySettings(tooltipSettings2)(setStore, store)
		expect(selectTooltipPayload(store, "axis", "hover", undefined)).toEqual(undefined)
		setMouseOverAxisIndex({
			activeCoordinate,
			activeDataKey: undefined,
			activeIndex: "1",
		})(setStore, store)
		expect(selectTooltipPayload(store, "axis", "hover", undefined)).toEqual([
			expectedEntry1,
			expectedEntry2,
		])
	})

	it("should return settings and data if defaultIndex is provided", () => {
		const [store, setStore] = createRechartsStore(preloadedState)
		const tooltipSettings1: TooltipPayloadConfiguration = {
			dataDefinedOnItem: undefined,
			getPosition: noop,
			settings: { graphicalItemId: "graphicalItemId1", nameKey: "y" },
		}
		const expectedEntry1: TooltipPayloadEntry = {
			dataKey: undefined,
			graphicalItemId: "graphicalItemId1",
			name: undefined,
			nameKey: "y",
			payload: undefined,
			value: undefined,
		}
		const tooltipSettings2: TooltipPayloadConfiguration = {
			dataDefinedOnItem: [
				{ x: 8, y: 9 },
				{ x: 10, y: 11 },
			],
			getPosition: noop,
			settings: {
				dataKey: "x",
				fill: "green",
				graphicalItemId: "graphicalItemId2",
				name: "foo",
				nameKey: "y",
				stroke: "red",
				unit: "bar",
			},
		}
		const expectedEntry2: TooltipPayloadEntry = {
			dataKey: "x",
			fill: "green",
			graphicalItemId: "graphicalItemId2",
			name: 11,
			nameKey: "y",
			payload: { x: 10, y: 11 },
			stroke: "red",
			unit: "bar",
			value: 10,
		}
		addTooltipEntrySettings(tooltipSettings1)(setStore, store)
		addTooltipEntrySettings(tooltipSettings2)(setStore, store)
		expect(selectTooltipPayload(store, "axis", "hover", "1")).toEqual([
			expectedEntry1,
			expectedEntry2,
		])
	})

	it("should fill in chartData, if it is not defined on the item for item hover", () => {
		const [store, setStore] = createRechartsStore(preloadedState)
		const tooltipSettings: TooltipPayloadConfiguration = {
			dataDefinedOnItem: undefined,
			getPosition: noop,
			settings: {
				dataKey: "y",
				fill: "green",
				graphicalItemId: "graphicalItemId1",
				name: "foo",
				nameKey: "x",
				stroke: "red",
				unit: "bar",
			},
		}
		addTooltipEntrySettings(tooltipSettings)(setStore, store)
		setChartData([
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
		])(setStore, store)
		setActiveMouseOverItemIndex({
			activeCoordinate,
			activeDataKey: "y",
			activeGraphicalItemId: tooltipSettings.settings.graphicalItemId,
			activeIndex: "0",
		})(setStore, store)

		const expectedEntry: TooltipPayloadEntry = {
			dataKey: "y",
			fill: "green",
			graphicalItemId: "graphicalItemId1",
			name: 1,
			nameKey: "x",
			payload: { x: 1, y: 2 },
			stroke: "red",
			unit: "bar",
			value: 2,
		}

		expect(selectTooltipPayload(store, "item", "hover", undefined)).toEqual([expectedEntry])
	})

	it("should return sliced data if set by Brush for item hover", () => {
		const [store, setStore] = createRechartsStore(preloadedState)
		const tooltipSettings: TooltipPayloadConfiguration = {
			dataDefinedOnItem: [
				{ x: 1, y: 2 },
				{ x: 3, y: 4 },
			],
			getPosition: noop,
			settings: {
				dataKey: "y",
				fill: "green",
				graphicalItemId: "graphicalItemId3",
				name: "foo",
				nameKey: "x",
				stroke: "red",
			},
		}
		addTooltipEntrySettings(tooltipSettings)(setStore, store)
		setChartData([
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
		])(setStore, store)
		expect(selectTooltipPayload(store, "item", "hover", undefined)).toEqual(undefined)
		setActiveMouseOverItemIndex({
			activeCoordinate,
			activeDataKey: "y",
			activeGraphicalItemId: tooltipSettings.settings.graphicalItemId,
			activeIndex: "0",
		})(setStore, store)
		setDataStartEndIndexes({ endIndex: 10, startIndex: 1 })(setStore, store)
		const expectedEntry: TooltipPayloadEntry = {
			dataKey: "y",
			fill: "green",
			graphicalItemId: "graphicalItemId3",
			name: 3,
			nameKey: "x",
			payload: { x: 3, y: 4 },
			stroke: "red",
			value: 4,
		}
		expect(selectTooltipPayload(store, "item", "hover", undefined)).toEqual([expectedEntry])
	})

	it("should return array of payloads for Scatter because Scatter naturally does its own special thing", () => {
		const chartDataState: ChartDataState = initialChartDataState
		const activeLabel: string | undefined = undefined
		const actual: TooltipPayload | undefined = combineTooltipPayload(
			[exampleTooltipPayloadConfiguration1],
			"0",
			chartDataState,
			undefined,
			activeLabel,
			arrayTooltipSearcher,
			"item",
		)
		const expectedEntry1: TooltipPayloadEntry = {
			color: undefined,
			dataKey: "x",
			fill: undefined,
			graphicalItemId: "graphicalItemId1",
			name: "stature",
			nameKey: "nameKey1",
			payload: {
				x: 100,
				y: 200,
				z: 200,
			},
			unit: "cm",
			value: 100,
		}
		const expectedEntry2: TooltipPayloadEntry = {
			color: undefined,
			dataKey: "y",
			fill: undefined,
			graphicalItemId: "graphicalItemId1",
			name: "weight",
			nameKey: "nameKey1",
			payload: {
				x: 100,
				y: 200,
				z: 200,
			},
			unit: "kg",
			value: 200,
		}
		const expected: ReadonlyArray<TooltipPayloadEntry> = [expectedEntry1, expectedEntry2]
		expect(actual).toEqual(expected)
	})

	it("should use dataKey from tooltipAxis, if item dataKey is undefined", () => {
		const tooltipPayloadConfiguration: TooltipPayloadConfiguration = {
			dataDefinedOnItem: [],
			getPosition: noop,
			settings: { graphicalItemId: "graphicalItemId1", nameKey: undefined },
		}
		const chartDataState: ChartDataState = initialChartDataState
		const activeLabel: string | undefined = undefined
		const actual: TooltipPayload | undefined = combineTooltipPayload(
			[tooltipPayloadConfiguration],
			"0",
			chartDataState,
			"dataKeyOnAxis",
			activeLabel,
			arrayTooltipSearcher,
			"axis",
		)
		const expected: TooltipPayloadEntry = {
			dataKey: "dataKeyOnAxis",
			graphicalItemId: "graphicalItemId1",
			payload: undefined,
			value: undefined,
		}
		expect(actual).toEqual([expected])
	})

	it.todo(
		"should do something - not quite sure what exactly yet - with tooltipAxis.allowDuplicatedCategory",
	)
})

describe("selectActiveIndex", () => {
	it("should return null for initial state", () => {
		const initialState = createRechartsStore().getState()
		const expected: TooltipIndex = null
		expect(selectActiveIndex(initialState, "axis", "hover", undefined)).toBe(expected)
		expect(selectActiveIndex(initialState, "axis", "click", undefined)).toBe(expected)
		expect(selectActiveIndex(initialState, "item", "hover", undefined)).toBe(expected)
		expect(selectActiveIndex(initialState, "item", "click", undefined)).toBe(expected)
	})

	it("should return defaultIndex if it is defined", () => {
		const initialState = createRechartsStore().getState()
		const expected: TooltipIndex = "7"
		expect(selectActiveIndex(initialState, "axis", "hover", "7")).toBe(expected)
		expect(selectActiveIndex(initialState, "axis", "click", "7")).toBe(expected)
		expect(selectActiveIndex(initialState, "item", "hover", "7")).toBe(expected)
		expect(selectActiveIndex(initialState, "item", "click", "7")).toBe(expected)
	})

	it("should ignore defaultIndex if item hover index is set and active", () => {
		const state = produceState((draft) => {
			draft.tooltip.itemInteraction.hover.active = true
			draft.tooltip.itemInteraction.hover.index = "7"
		})
		expect(selectActiveIndex(state, "axis", "hover", "8")).toBe("8" satisfies TooltipIndex)
		expect(selectActiveIndex(state, "axis", "click", "8")).toBe("8" satisfies TooltipIndex)
		expect(selectActiveIndex(state, "item", "hover", "8")).toBe("7" satisfies TooltipIndex)
		expect(selectActiveIndex(state, "item", "click", "8")).toBe("8" satisfies TooltipIndex)
	})

	it("should return item hover index", () => {
		const state = produceState((draft) => {
			draft.tooltip.itemInteraction.hover.active = true
			draft.tooltip.itemInteraction.hover.index = "7"
		})
		const expected: TooltipIndex = "7"
		expect(selectActiveIndex(state, "item", "hover", "9")).toBe(expected)
	})

	it("should return item click index", () => {
		const state = produceState((draft) => {
			draft.tooltip.itemInteraction.click.active = true
			draft.tooltip.itemInteraction.click.index = "7"
		})
		const expected: TooltipIndex = "7"
		expect(selectActiveIndex(state, "item", "click", "11")).toBe(expected)
	})

	it("should return axis hover index", () => {
		const state = produceState((draft) => {
			draft.tooltip.axisInteraction.hover.active = true
			draft.tooltip.axisInteraction.hover.index = "7"
		})
		const expected: TooltipIndex = "7"
		expect(selectActiveIndex(state, "axis", "hover", "13")).toBe(expected)
	})

	it("should return axis click index", () => {
		const state = produceState((draft) => {
			draft.tooltip.axisInteraction.click.active = true
			draft.tooltip.axisInteraction.click.index = "7"
		})
		const expected: TooltipIndex = "7"
		expect(selectActiveIndex(state, "axis", "click", "17")).toBe(expected)
	})
})

describe("selectActiveCoordinate", () => {
	it("should return undefined for initial state", () => {
		const initialState = createRechartsStore().getState()
		const expected: Coordinate | PolarCoordinate | undefined = undefined
		expect(selectActiveCoordinate(initialState, "axis", "hover", undefined)).toBe(expected)
		expect(selectActiveCoordinate(initialState, "axis", "click", undefined)).toBe(expected)
		expect(selectActiveCoordinate(initialState, "item", "hover", undefined)).toBe(expected)
		expect(selectActiveCoordinate(initialState, "item", "click", undefined)).toBe(expected)
	})

	it("should return coordinates when mouseOverAxisIndex is fired and stop returning them after mouseLeaveChart", () => {
		const [store, setStore] = createRechartsStore(preloadedState)

		const initialState = createRechartsStore().getState()
		const expected: Coordinate | PolarCoordinate | undefined = { x: 100, y: 150 }
		expect(selectActiveCoordinate(initialState, "axis", "hover", undefined)).toBe(undefined)

		setMouseOverAxisIndex({
			activeCoordinate: expected,
			activeDataKey: undefined,
			activeIndex: "1",
		})(setStore, store)

		/* GOTCHA-003: Solid store wraps values in a proxy, so .toBe identity through dispatch+select is unstable. */
		expect(selectActiveCoordinate(store, "axis", "hover", undefined)).toEqual(expected)

		mouseLeaveChart()(setStore, store)

		expect(selectActiveCoordinate(store, "axis", "hover", undefined)).toEqual({ x: 100, y: 150 })
		/* the selector stops returning the coordinates but they should still be present in store for the next animation */
		expect(store.tooltip.axisInteraction.hover.coordinate).toEqual(expected)
	})

	it("should return coordinates when mouseClickAxisIndex is fired and keep them after mouseLeaveChart", () => {
		const [store, setStore] = createRechartsStore(preloadedState)

		const initialState = createRechartsStore().getState()
		const expected: Coordinate | PolarCoordinate | undefined = { x: 100, y: 150 }
		expect(selectActiveCoordinate(initialState, "axis", "click", undefined)).toBe(undefined)

		setMouseClickAxisIndex({
			activeCoordinate: expected,
			activeDataKey: undefined,
			activeIndex: "1",
		})(setStore, store)

		/* GOTCHA-003: Solid store wraps values in a proxy, so .toBe identity through dispatch+select is unstable. */
		expect(selectActiveCoordinate(store, "axis", "click", undefined)).toEqual(expected)

		mouseLeaveChart()(setStore, store)

		expect(selectActiveCoordinate(store, "axis", "click", undefined)).toEqual(expected)
	})

	it("should return coordinates when mouseOverItemIndex is fired and keep them after mouseLeaveItem", () => {
		const [store, setStore] = createRechartsStore(preloadedState)

		const initialState = createRechartsStore().getState()
		const expected: Coordinate | PolarCoordinate | undefined = { x: 100, y: 150 }
		expect(selectActiveCoordinate(initialState, "item", "hover", undefined)).toBe(undefined)

		setActiveMouseOverItemIndex({
			activeCoordinate: expected,
			activeDataKey: undefined,
			activeGraphicalItemId: "id-1",
			activeIndex: "1",
		})(setStore, store)

		/* GOTCHA-003: Solid store proxy breaks .toBe identity through dispatch. */
		expect(selectActiveCoordinate(store, "item", "hover", undefined)).toEqual(expected)

		/* neither of these reset the coordinates and the selector does NOT stop returning them */
		mouseLeaveItem()(setStore, store)
		mouseLeaveChart()(setStore, store)

		expect(selectActiveCoordinate(store, "item", "hover", undefined)).toEqual({
			x: 100,
			y: 150,
		})
		/* the selector stops returning the coordinates but they should still be present in store for the next animation */
		expect(store.tooltip.itemInteraction.hover.coordinate).toEqual(expected)
	})

	it("should return coordinates when mouseClickItemIndex is fired and keep them after mouseLeaveItem", () => {
		const [store, setStore] = createRechartsStore(preloadedState)

		const initialState = createRechartsStore().getState()
		const expected: Coordinate | PolarCoordinate | undefined = {
			x: 100,
			y: 150,
		}
		expect(selectActiveCoordinate(initialState, "item", "click", undefined)).toBe(undefined)

		setActiveClickItemIndex({
			activeCoordinate: expected,
			activeDataKey: undefined,
			activeGraphicalItemId: "id-1",
			activeIndex: "1",
		})(setStore, store)

		/* GOTCHA-003: Solid store proxy breaks .toBe identity through dispatch. */
		expect(selectActiveCoordinate(store, "item", "click", undefined)).toEqual(expected)

		/* neither of these should reset coordinate */
		mouseLeaveItem()(setStore, store)
		mouseLeaveChart()(setStore, store)

		expect(selectActiveCoordinate(store, "item", "click", undefined)).toEqual(expected)
	})
})

describe("selectTooltipPayloadConfigurations", () => {
	let exampleStore: Store<RechartsRootState>

	beforeEach(() => {
		exampleStore = createRechartsStore()
		exampleStore.dispatch(addTooltipEntrySettings(exampleTooltipPayloadConfiguration1))
		exampleStore.dispatch(addTooltipEntrySettings(exampleTooltipPayloadConfiguration2))
	})

	describe.each(allTooltipCombinations)(
		"tooltipEventType: $tooltipEventType tooltipTrigger: $trigger",
		({ tooltipEventType, trigger }) => {
			it("should return undefined when outside of Redux context", () => {
				expect.assertions(1)
				const Comp = (): null => {
					const result = useAppSelectorWithStableTest((state) =>
						selectTooltipPayloadConfigurations(state, tooltipEventType, trigger, undefined),
					)
					expect(result).toBe(undefined)
					return null
				}
				render(() => <Comp />)
			})

			it("should return empty array from empty state", () => {
				const [store, setStore] = createRechartsStore()
				expect(
					selectTooltipPayloadConfigurations(store, tooltipEventType, trigger, undefined),
				).toEqual([])
			})
		},
	)

	describe.each<TooltipTrigger>(["hover", "click"])(
		'tooltipEventType: "axis" tooltipTrigger: %s',
		(trigger) => {
			it("should return unfiltered configurations with tooltipEventType: axis", () => {
				const expected: ReadonlyArray<TooltipPayloadConfiguration> = [
					exampleTooltipPayloadConfiguration1,
					exampleTooltipPayloadConfiguration2,
				]
				expect(
					selectTooltipPayloadConfigurations(exampleStore.getState(), "axis", trigger, undefined),
				).toEqual(expected)
			})
		},
	)

	it("should filter by dataKey with tooltipEventType: item and trigger: hover", () => {
		exampleStore.dispatch(
			setActiveMouseOverItemIndex({
				activeCoordinate: undefined,
				activeDataKey: "dataKey1",
				activeGraphicalItemId: exampleTooltipPayloadConfiguration1.settings.graphicalItemId,
				activeIndex: "1",
			}),
		)
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", undefined),
		).toEqual([exampleTooltipPayloadConfiguration1])
		exampleStore.dispatch(
			setActiveMouseOverItemIndex({
				activeCoordinate: undefined,
				activeDataKey: "dataKey2",
				activeGraphicalItemId: exampleTooltipPayloadConfiguration2.settings.graphicalItemId,
				activeIndex: "1",
			}),
		)
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", undefined),
		).toEqual([exampleTooltipPayloadConfiguration2])
	})

	it("should return nothing if the tooltipEventType is hover but the only interactions are clicks", () => {
		exampleStore.dispatch(
			setActiveClickItemIndex({
				activeCoordinate: undefined,
				activeDataKey: "dataKey1",
				activeGraphicalItemId: "foo",
				activeIndex: "1",
			}),
		)
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", undefined),
		).toEqual([])
		exampleStore.dispatch(setMouseClickAxisIndex({ activeDataKey: "dataKey2", activeIndex: "1" }))
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", undefined),
		).toEqual([])
	})

	it("should return nothing if the tooltipEventType is click but the only interactions are hovers", () => {
		exampleStore.dispatch(
			setActiveMouseOverItemIndex({
				activeCoordinate: undefined,
				activeDataKey: "dataKey1",
				activeGraphicalItemId: "foo",
				activeIndex: "1",
			}),
		)
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "click", undefined),
		).toEqual([])
		exampleStore.dispatch(setMouseOverAxisIndex({ activeDataKey: "dataKey2", activeIndex: "1" }))
		expect(
			selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "click", undefined),
		).toEqual([])
	})

	describe("with defaultIndex", () => {
		it("should return the first configuration if the tooltipEventType is item and the defaultIndex is set, before user started interacting with the chart", () => {
			expect(
				selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", "1"),
			).toEqual([exampleTooltipPayloadConfiguration1])
		})

		it("should return configuration that matches the dataKey after user has started interacting", () => {
			exampleStore.dispatch(
				setActiveMouseOverItemIndex({
					activeCoordinate: undefined,
					activeDataKey: "dataKey2",
					activeGraphicalItemId: exampleTooltipPayloadConfiguration2.settings.graphicalItemId,
					activeIndex: "1",
				}),
			)
			expect(
				selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", "1"),
			).toEqual([exampleTooltipPayloadConfiguration2])
		})

		it("should return empty array if user interacted with a an item that is not represented in the tooltip payloads", () => {
			exampleStore.dispatch(
				setActiveMouseOverItemIndex({
					activeCoordinate: undefined,
					activeDataKey: "dataKey-notPresentInPayloads",
					activeGraphicalItemId: "id-notPresentInPayloads",
					activeIndex: "1",
				}),
			)
			expect(
				selectTooltipPayloadConfigurations(exampleStore.getState(), "item", "hover", "1"),
			).toEqual([])
		})
	})
})

describe("selectIsTooltipActive", () => {
	describe.each(allTooltipCombinations)(
		"tooltipEventType: $tooltipEventType tooltipTrigger: $trigger",
		({ tooltipEventType, trigger }) => {
			it("should return undefined when outside of Redux state", () => {
				expect.assertions(1)
				const Comp = (): null => {
					const result = useAppSelectorWithStableTest((state) =>
						selectIsTooltipActive(state, tooltipEventType, trigger, undefined),
					)
					expect(result).toBe(undefined)
					return null
				}
				render(() => <Comp />)
			})

			it("should return false from initial state", () => {
				const [store, setStore] = createRechartsStore()
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})

			it("should return true if a defaultIndex has been set", () => {
				const [store, setStore] = createRechartsStore()
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, "1")).toEqual({
					activeIndex: "1",
					isActive: true,
				})
			})
		},
	)

	describe("trigger: hover", () => {
		const trigger = "hover"

		describe.each(allTooltipEventTypes)("tooltipEventType: %s", (tooltipEventType) => {
			it("should return false if user is clicking on a graphical item", () => {
				/* in browser, this is difficult to reproduce - one usually has to mouse over first before clicking */
				const [store, setStore] = createRechartsStore()
				setActiveClickItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})

			it("should return false if user is clicking on an axis", () => {
				/* in browser, this is difficult to reproduce - one usually has to mouse over first before clicking */
				const [store, setStore] = createRechartsStore()
				setMouseClickAxisIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})
		})

		describe("tooltipEventType: item", () => {
			const tooltipEventType = "item"
			it("should return true if user is hovering over a graphical item but not axis", () => {
				const [store, setStore] = createRechartsStore()
				setMouseOverAxisIndex({ activeCoordinate, activeDataKey: undefined, activeIndex: "1" })(
					setStore,
					store,
				)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
				setActiveMouseOverItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				mouseLeaveItem()(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})

			it("should return false after mouse leaves the chart element", () => {
				const [store, setStore] = createRechartsStore()
				setActiveMouseOverItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "id-1",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				mouseLeaveChart()(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})
		})

		describe("tooltipEventType: axis", () => {
			const tooltipEventType = "axis"
			it(`should return true if user is hovering over an axis,
          and then continue returning true when user hovers over and then leaves a graphical item`, () => {
				const [store, setStore] = createRechartsStore()
				setActiveMouseOverItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
				setMouseOverAxisIndex({ activeCoordinate, activeDataKey: undefined, activeIndex: "1" })(
					setStore,
					store,
				)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				setActiveMouseOverItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				mouseLeaveItem()(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
			})

			it.todo("should return false after mouse leaves the chart element")
		})
	})

	describe("trigger: click", () => {
		const trigger = "click"

		describe.each(allTooltipEventTypes)("tooltipEventType: %s", (tooltipEventType) => {
			it("should return false if user is hovering over a graphical item", () => {
				const [store, setStore] = createRechartsStore()
				setActiveMouseOverItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})

			it("should return false if user is hovering over an axis", () => {
				const [store, setStore] = createRechartsStore()
				setMouseOverAxisIndex({ activeCoordinate, activeDataKey: undefined, activeIndex: null })(
					setStore,
					store,
				)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})
		})

		describe("tooltipEventType: item", () => {
			const tooltipEventType = "item"
			it(`should return true if user is clicking a graphical item and continue returning true forever,
          because recharts does not allow ever turning off a tooltip that was triggered by a click`, () => {
				const [store, setStore] = createRechartsStore()
				setActiveClickItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "foo",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				setActiveClickItemIndex({
					activeCoordinate,
					activeDataKey: undefined,
					activeGraphicalItemId: "bar",
					activeIndex: "2",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
				mouseLeaveItem()(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
				setMouseClickAxisIndex({ activeCoordinate, activeDataKey: undefined, activeIndex: "1" })(
					setStore,
					store,
				)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
			})

			it("should return false if user is clicking on an axis", () => {
				const [store, setStore] = createRechartsStore()
				setMouseClickAxisIndex({ activeCoordinate, activeDataKey: "dataKey1", activeIndex: "1" })(
					setStore,
					store,
				)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: null,
					isActive: false,
				})
			})
		})

		describe("tooltipEventType: axis", () => {
			const tooltipEventType = "axis"
			it("should return true if user is clicking on an axis, and continue returning true forever", () => {
				const [store, setStore] = createRechartsStore()
				setMouseClickAxisIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "1",
					isActive: true,
				})
				setMouseClickAxisIndex({
					activeCoordinate,
					activeDataKey: undefined,
					activeIndex: "2",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
				mouseLeaveItem()(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
				setActiveClickItemIndex({
					activeCoordinate,
					activeDataKey: "dataKey1",
					activeGraphicalItemId: "id-1",
					activeIndex: "1",
				})(setStore, store)
				expect(selectIsTooltipActive(store, tooltipEventType, trigger, undefined)).toEqual({
					activeIndex: "2",
					isActive: true,
				})
			})
		})
	})
})

describe("selectActiveIndexFromChartPointer", () => {
	const exampleChartPointer: RelativePointer = {
		relativeX: 10,
		relativeY: 10,
	}

	const selector = (state: RechartsRootState) =>
		selectActivePropsFromChartPointer(state, exampleChartPointer)

	shouldReturnUndefinedOutOfContext(selector)
	shouldReturnFromInitialState(selector, undefined)

	it("should return active props after mouse hover", () => {
		const tooltipActiveSpy = vi.fn()
		mockGetBoundingClientRect({ height: 100, width: 100 })
		const Comp = (): null => {
			createEffect(() =>
				tooltipActiveSpy(
					useAppSelector((state) =>
						selectActivePropsFromChartPointer(state, exampleChartPointer),
					),
				),
			)
			return null
		}
		render(() => (
			<LineChart data={pageData} width={100} height={100}>
				<Line dataKey="pv" />
				<Comp />
			</LineChart>
		))

		expect(tooltipActiveSpy).toHaveBeenLastCalledWith({
			activeCoordinate: {
				x: 5,
				y: 10,
			},
			activeIndex: "0",
		})
	})

	it("should be stable", () => {
		expect.assertions(1)
		mockGetBoundingClientRect({ height: 100, width: 100 })
		const Comp = (): null => {
			const result1 = useAppSelector((state) =>
				selectActivePropsFromChartPointer(state, exampleChartPointer),
			)
			const result2 = useAppSelector((state) =>
				selectActivePropsFromChartPointer(state, exampleChartPointer),
			)
			expect(result1).toEqual(result2)
			return null
		}
		render(() => (
			<LineChart data={pageData} width={100} height={100}>
				<Line dataKey="pv" />
				<Comp />
			</LineChart>
		))
	})
})

describe("selectTooltipState.tooltipItemPayloads", () => {
	it("should return undefined when called outside of Redux context", () => {
		expect.assertions(1)
		const Comp = (): null => {
			const payload = useAppSelector(selectTooltipState)
			expect(payload).toBe(undefined)
			return null
		}
		render(() => <Comp />)
	})

	it("should return empty array for initial state", () => {
		const [store, setStore] = createRechartsStore()
		expect(selectTooltipState(store).tooltipItemPayloads).toEqual([])
	})

	it("should return empty array in an empty chart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => {
				const tooltipData = useAppSelector(selectTooltipState)?.tooltipItemPayloads.map(
					(tp) => tp.dataDefinedOnItem,
				)
				spy(tooltipData)
			})
			return null
		}
		render(() => (
			<BarChart data={PageData} width={100} height={100}>
				<Comp />
			</BarChart>
		))
		expectLastCalledWith(spy, [])
	})

	it("should return all tooltip payloads defined on graphical items in ComposedChart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => {
				const tooltipData = useAppSelector(selectTooltipState)?.tooltipItemPayloads.map(
					(tp) => tp.dataDefinedOnItem,
				)
				spy(tooltipData)
			})
			return null
		}
		render(() => (
			<ComposedChart data={PageData} width={100} height={100}>
				<Area dataKey="" data={[1, 2, 3]} />
				<Area dataKey="" data={[10, 20, 30]} />
				<Line data={[4, 5, 6]} />
				<Line data={[40, 50, 60]} />
				<Scatter data={[{ x: 7 }, { x: 8 }, { x: 9 }]} dataKey="x" />
				<Scatter data={[{ y: 70 }, { y: 80 }, { y: 90 }]} dataKey="y" />
				<Comp />
			</ComposedChart>
		))
		/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(3) */
		expectLastCalledWith(spy, [
			[1, 2, 3],
			[10, 20, 30],
			[4, 5, 6],
			[40, 50, 60],
			[
				[
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 7,
						},
						type: undefined,
						unit: "",
						value: 7,
					},
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 7,
						},
						type: undefined,
						unit: "",
						value: 7,
					},
				],
				[
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 8,
						},
						type: undefined,
						unit: "",
						value: 8,
					},
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 8,
						},
						type: undefined,
						unit: "",
						value: 8,
					},
				],
				[
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 9,
						},
						type: undefined,
						unit: "",
						value: 9,
					},
					{
						dataKey: "x",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							x: 9,
						},
						type: undefined,
						unit: "",
						value: 9,
					},
				],
			],
			[
				[
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 70,
						},
						type: undefined,
						unit: "",
						value: 70,
					},
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 70,
						},
						type: undefined,
						unit: "",
						value: 70,
					},
				],
				[
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 80,
						},
						type: undefined,
						unit: "",
						value: 80,
					},
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 80,
						},
						type: undefined,
						unit: "",
						value: 80,
					},
				],
				[
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 90,
						},
						type: undefined,
						unit: "",
						value: 90,
					},
					{
						dataKey: "y",
						graphicalItemId: expect.stringMatching(/^recharts-scatter-.+/),
						name: undefined,
						payload: {
							y: 90,
						},
						type: undefined,
						unit: "",
						value: 90,
					},
				],
			],
		])
	})

	it("should return all payloads in PieChart", () => {
		const spy = vi.fn()
		const Comp = (): null => {
			createEffect(() => {
				const tooltipData = useAppSelector(selectTooltipState)?.tooltipItemPayloads.map(
					(tp) => tp.dataDefinedOnItem,
				)
				spy(tooltipData)
			})
			return null
		}
		rechartsTestRender(() => (
			<PieChart width={100} height={100}>
				<Comp />
				<Pie data={[{ x: 1 }, { x: 2 }, { x: 3 }]} dataKey="x" id="pie-1" />
				<Pie data={[{ y: 10 }, { y: 20 }, { y: 30 }]} dataKey="y" id="pie-2" />
			</PieChart>
		))
		/* GOTCHA-007-E sibling-mount-order: expect(spy).toHaveBeenCalledTimes(2) */
		expectLastCalledWith(spy, [
			[
				[
					{
						dataKey: "x",
						graphicalItemId: "pie-1",
						name: 0,
						payload: { x: 1 },
						type: undefined,
						value: 1,
					},
				],
				[
					{
						dataKey: "x",
						graphicalItemId: "pie-1",
						name: 1,
						payload: { x: 2 },
						type: undefined,
						value: 2,
					},
				],
				[
					{
						dataKey: "x",
						graphicalItemId: "pie-1",
						name: 2,
						payload: { x: 3 },
						type: undefined,
						value: 3,
					},
				],
			],
			[
				[
					{
						dataKey: "y",
						graphicalItemId: "pie-2",
						name: 0,
						payload: { y: 10 },
						type: undefined,
						value: 10,
					},
				],
				[
					{
						dataKey: "y",
						graphicalItemId: "pie-2",
						name: 1,
						payload: { y: 20 },
						type: undefined,
						value: 20,
					},
				],
				[
					{
						dataKey: "y",
						graphicalItemId: "pie-2",
						name: 2,
						payload: { y: 30 },
						type: undefined,
						value: 30,
					},
				],
			],
		])
	})
})
