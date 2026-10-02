import { createContext, useContext } from "solid-js"
import type { RechartsTheme } from "./RechartsTheme"
import { legacyTheme } from "./legacyTheme"

const RechartsThemeContext = createContext<RechartsTheme>(legacyTheme)

/**
 * Applies the provided theme to all charts in the children tree.
 *
 * @experimental
 */
export const RechartsThemeProvider = RechartsThemeContext

/**
 * Reads the currently active theme in the children tree.
 *
 * @experimental
 */
export const useRechartsTheme = (): RechartsTheme => useContext(RechartsThemeContext)
