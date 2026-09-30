import { createContext, useContext, type JSX } from "solid-js"

const PanoramaContext = createContext<boolean | null>(null)

export const useIsPanorama = (): boolean => useContext(PanoramaContext) != null

export const PanoramaContextProvider = (props: { children: JSX.Element }) => (
	<PanoramaContext.Provider value>{props.children}</PanoramaContext.Provider>
)
