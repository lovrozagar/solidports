import { createContext, useContext, type JSX } from "solid-js"
import { useUniqueId } from "../util/useUniqueId"
import type { GraphicalItemId } from "../state/graphicalItemsSlice"

export type IdSetter = {
	/**
	 * Children must be a function that receives the resolved ID of the graphical item.
	 * This ID will either be the one provided via props.id or generated automatically.
	 */
	children: (id: GraphicalItemId) => JSX.Element
	id?: string
	type: string
}

const GraphicalItemIdContext = createContext<GraphicalItemId | undefined>(undefined)

export const RegisterGraphicalItemId = (props: IdSetter) => {
	/* eslint-disable-next-line solid/reactivity -- IDs are stable; useUniqueId calls useId() which must run at setup, not in a memo */
	const resolvedId = useUniqueId(`recharts-${props.type}`, props.id)
	return (
		<GraphicalItemIdContext.Provider value={resolvedId}>
			{props.children(resolvedId)}
		</GraphicalItemIdContext.Provider>
	)
}

export function useGraphicalItemId(): GraphicalItemId | undefined {
	return useContext(GraphicalItemIdContext)
}
