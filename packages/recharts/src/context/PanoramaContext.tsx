import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
const PanoramaContext = createContext<boolean | null>(null)

export const useIsPanorama = (): boolean => useContext(PanoramaContext) != null

export const PanoramaContextProvider = (props: { children: JSX.Element }) => (
	<PanoramaContext value>{props.children}</PanoramaContext>
)
