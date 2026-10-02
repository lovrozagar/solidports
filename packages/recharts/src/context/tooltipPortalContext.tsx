import type { Accessor } from 'solid-js';
import { createContext, useContext } from 'solid-js';
/* Solid context Provider stores `props.value` once at mount and never propagates
   later signal updates to descendants. Provider value must be an Accessor so
   consumers can read the current value reactively each call. */
export type TooltipPortalAccessor = Accessor<HTMLElement | null>

const defaultTooltipPortal: TooltipPortalAccessor = () => null

export const TooltipPortalContext = createContext<TooltipPortalAccessor>(defaultTooltipPortal)

export const useTooltipPortal = (): TooltipPortalAccessor => useContext(TooltipPortalContext)
