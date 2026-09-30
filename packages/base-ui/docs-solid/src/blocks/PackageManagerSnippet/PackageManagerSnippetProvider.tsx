import { createContext, createSignal, useContext, type Accessor, type ParentProps } from "solid-js"

/* V1 minimal provider. Full snippet rendering lives in V2. */

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

export interface PackageManagerSnippetContextValue {
  value: Accessor<PackageManager>
  setValue: (v: PackageManager) => void
}

const Context = createContext<PackageManagerSnippetContextValue | undefined>(undefined)

export function usePackageManagerSnippet() {
  return useContext(Context)
}

interface ProviderProps extends ParentProps {
  defaultValue?: PackageManager
}

export function PackageManagerSnippetProvider(props: ProviderProps) {
  const [value, setValue] = createSignal<PackageManager>(props.defaultValue ?? "npm")
  return (
    <Context.Provider value={{ value, setValue }}>{props.children}</Context.Provider>
  )
}
