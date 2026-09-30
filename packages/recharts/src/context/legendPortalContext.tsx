import type { Accessor } from "solid-js"
import { createContext, useContext } from "solid-js"

/* Solid context Provider stores `props.value` once at mount and never propagates
   later signal updates to descendants. Provider value must be an Accessor so
   consumers can read the current value reactively each call. */
export type LegendPortalAccessor = Accessor<HTMLElement | null>

const defaultLegendPortal: LegendPortalAccessor = () => null

export const LegendPortalContext = createContext<LegendPortalAccessor>(defaultLegendPortal)

export const useLegendPortal = (): LegendPortalAccessor => useContext(LegendPortalContext)
