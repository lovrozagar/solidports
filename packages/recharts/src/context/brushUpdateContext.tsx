import { createContext } from "solid-js"

export type BrushStartEndIndex = {
	endIndex: number
	startIndex: number
}

export type OnBrushUpdate = (newState: BrushStartEndIndex) => void

export const BrushUpdateDispatchContext = createContext<OnBrushUpdate>(() => {})
