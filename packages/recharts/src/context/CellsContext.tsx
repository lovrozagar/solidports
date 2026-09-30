/* eslint-disable import/no-cycle, sort-keys */
import { createContext, onCleanup, useContext } from "solid-js"
import { createStore, produce } from "solid-js/store"

/* React parity: upstream walks `props.children` via `findAllByType(Cell)` to
 * discover per-data-point overrides (fill, stroke, ...). Solid JSX is opaque —
 * descendants resolve to DOM nodes, not vnodes — so introspection is impossible.
 * Instead, <Cell/> calls `register()` at setup time to hand its props up; the
 * graphical-item parent (Bar/Pie/Scatter/...) reads `cells()` to get an
 * insertion-ordered array shaped like upstream's findAllByType result. */

export type CellPropsRecord = Record<string, unknown>

/* Upstream code reads `cells[i].props` — keep that wrapper shape so existing
 * computeBarRectangles / Pie / Scatter logic spreads `(cells[i] as { props }).props`
 * unchanged. */
export type RegisteredCell = { props: CellPropsRecord }

type CellsRegistry = {
	register: (props: () => CellPropsRecord) => void
	cells: () => ReadonlyArray<RegisteredCell>
}

const CellsContext = createContext<CellsRegistry | null>(null)

/* Each Cell entry stores the prop accessor — re-reading at consumer time keeps
 * fill/stroke reactive to upstream signal changes (e.g. row.visitors > 0
 * branch flipping in BarNegative). */
type Entry = { id: number; getProps: () => CellPropsRecord }

export function createCellsRegistry(): CellsRegistry & {
	Provider: typeof CellsContext.Provider
} {
	const [state, setState] = createStore<{ entries: Entry[]; counter: number }>({
		entries: [],
		counter: 0,
	})

	const register = (getProps: () => CellPropsRecord): void => {
		const id = state.counter
		setState(
			produce((s) => {
				s.entries.push({ id, getProps })
				s.counter += 1
			}),
		)
		onCleanup(() => {
			setState(
				produce((s) => {
					const idx = s.entries.findIndex((e) => e.id === id)
					if (idx !== -1) s.entries.splice(idx, 1)
				}),
			)
		})
	}

	const cells = (): ReadonlyArray<RegisteredCell> =>
		state.entries.map((e) => ({ props: e.getProps() }))

	return { register, cells, Provider: CellsContext.Provider }
}

export function useCellsRegistry(): CellsRegistry | null {
	return useContext(CellsContext)
}

export const CellsContextProvider = CellsContext.Provider
