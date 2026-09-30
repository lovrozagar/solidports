import {
  createContext,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js"

export interface DemoVariantSelectorContextValue {
  selectedVariant: Accessor<string | null>
  setSelectedVariant: (value: string | null) => void
  selectedLanguage: Accessor<string>
  setSelectedLanguage: (value: string) => void
}

export const DemoVariantSelectorContext =
  createContext<DemoVariantSelectorContextValue | null>(null)

export function useDemoVariantSelectorContext() {
  const ctx = useContext(DemoVariantSelectorContext)
  if (!ctx) throw new Error("Missing DemoVariantSelectorContext")
  return ctx
}

interface Props extends ParentProps {
  defaultVariant: string
  defaultLanguage: string
}

const VARIANT_STORAGE_KEY = "preferredDemoVariant"
const LANGUAGE_STORAGE_KEY = "preferredDemoLanguage"

export function DemoVariantSelectorProvider(props: Props) {
  const [selectedVariant, setSelectedVariantRaw] = createSignal<string | null>(
    props.defaultVariant,
  )
  const [selectedLanguage, setSelectedLanguageRaw] = createSignal<string>(
    props.defaultLanguage,
  )

  function setSelectedVariant(value: string | null) {
    setSelectedVariantRaw(value)
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VARIANT_STORAGE_KEY, value ?? "")
    }
  }

  function setSelectedLanguage(value: string) {
    setSelectedLanguageRaw(value)
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
    }
  }

  onMount(() => {
    const variantPref = localStorage.getItem(VARIANT_STORAGE_KEY)
    const languagePref = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (variantPref) {
      /* migrate legacy kebab-case stored value from earlier release */
      let normalized = variantPref
      if (variantPref === "css-modules") normalized = "CssModules"
      else if (variantPref === "tailwind") normalized = "Tailwind"
      setSelectedVariantRaw(normalized)
    }
    if (languagePref) setSelectedLanguageRaw(languagePref)
  })

  return (
    <DemoVariantSelectorContext.Provider
      value={{
        selectedVariant,
        setSelectedVariant,
        selectedLanguage,
        setSelectedLanguage,
      }}
    >
      {props.children}
    </DemoVariantSelectorContext.Provider>
  )
}
