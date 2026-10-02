/* eslint-disable import/no-cycle, sort-keys */
import { createContext, createSignal, onCleanup, useContext } from 'solid-js';
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

export type CellsRegistry = {
	register: (props: () => CellPropsRecord) => void
	cells: () => ReadonlyArray<RegisteredCell>
}

const CellsContext = createContext<CellsRegistry | null>(null)

/* Each Cell entry stores the prop accessor — re-reading at consumer time keeps
 * fill/stroke reactive to upstream signal changes (e.g. row.visitors > 0
 * branch flipping in BarNegative). */
type Entry = { id: number; getProps: () => CellPropsRecord }

export function createCellsRegistry(): CellsRegistry & {
	Provider: typeof CellsContext
} {
	/* Cells register from their component body, so this registry opts into owned writes. */
	const [entries, setEntries] = createSignal<ReadonlyArray<Entry>>([], { ownedWrite: true })
	let nextId = 0

	const register = (getProps: () => CellPropsRecord): void => {
		const id = nextId++
		setEntries((prev) => [...prev, { id, getProps }])
		onCleanup(() => {
			setEntries((prev) => prev.filter((e) => e.id !== id))
		})
	}

	const cells = (): ReadonlyArray<RegisteredCell> =>
		entries().map((e) => ({ props: e.getProps() }))

	return { register, cells, Provider: CellsContext }
}

export function useCellsRegistry(): CellsRegistry | null {
	return useContext(CellsContext)
}

export const CellsContextProvider = CellsContext
