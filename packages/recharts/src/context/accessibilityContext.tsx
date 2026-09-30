import { useChartStore } from "../state/RechartsStoreContext"

export const useAccessibilityLayer = (): boolean => {
	const ctx = useChartStore()
	return ctx?.store.rootProps.accessibilityLayer ?? true
}
