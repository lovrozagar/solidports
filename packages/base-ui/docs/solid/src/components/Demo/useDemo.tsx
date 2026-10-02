import {
  createEffect,
  createMemo,
  createSignal,
  lazy,
  onSettled,
  Show,
  Loading,
  useContext,
} from 'solid-js';
import type { Accessor, Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import { DemoVariantSelectorContext } from "./DemoVariantSelectorProvider"

function fileNameToLanguage(fileName: string): string {
  if (fileName.endsWith(".tsx") || fileName.endsWith(".ts")) return "tsx"
  if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) return "jsx"
  if (fileName.endsWith(".json")) return "json"
  if (fileName.endsWith(".html")) return "html"
  if (fileName.endsWith(".css")) return "css"
  if (fileName.endsWith(".mdx")) return "mdx"
  return "tsx"
}

export interface DemoVariant {
  name: string
  files: Record<string, string>
}

export interface DemoFile {
  name: string
  slug?: string
  text: string
  /** Highlighted at transform time by `viteDemoHighlight`. */
  html?: string
  lang: string
  lines: number
}

/** Shape of a `?highlighted` demo source import. */
interface HighlightedSource {
  text: string
  html: string
}

export interface DemoApi {
  component: JSX.Element
  selectedVariant: Accessor<string>
  selectVariant: (variant: string) => void
  variants: string[]
  files: Accessor<DemoFile[]>
  selectedFile: Accessor<DemoFile | undefined>
  selectedFileName: Accessor<string | undefined>
  selectFileName: (fileName: string) => void
  selectedFileLines: Accessor<number>
  expanded: Accessor<boolean>
  setExpanded: (value: boolean) => void
  expand: () => void
  copy: () => void
  openStackBlitz: () => void
  openCodeSandbox: () => void
  allFilesSlugs: Accessor<{ slug: string }[]>
  availableTransforms: string[]
  selectedTransform: Accessor<string | null>
  selectTransform: (name: string | null) => void
}

interface UseDemoProps {
  name?: string
  slug?: string
  /** Path relative to src/demos/solid/, e.g. "accordion/hero" */
  path: string
}

interface UseDemoOptions {
  copy?: { onCopied?: () => void }
  defaultOpen?: boolean
}

/* Variant source + component loaders for every demo index.tsx. Matched by path segment. */
const componentModules = import.meta.glob<{ default: Component }>(
  "../../demos/solid/**/index.tsx",
)
const sourceModules = import.meta.glob<HighlightedSource>(
  "../../demos/solid/**/index.tsx",
  { import: "default", query: "?highlighted" },
)
const sharedModuleSources = import.meta.glob<HighlightedSource>(
  "../../demos/solid/**/_index.module.css",
  { import: "default", query: "?highlighted" },
)
const variantCssSources = import.meta.glob<HighlightedSource>(
  "../../demos/solid/**/*.module.css",
  { import: "default", query: "?highlighted" },
)

function componentDirFromPath(path: string): string {
  return path.split("/")[0] ?? ""
}

function sharedModuleKey(path: string): string {
  return `../../demos/solid/${componentDirFromPath(path)}/_index.module.css`
}

const cssSourceCache = new Map<string, Promise<HighlightedSource>>()
function cachedCssSource(
  key: string,
  glob: Record<string, () => Promise<HighlightedSource>>,
): Promise<HighlightedSource> | null {
  const hit = cssSourceCache.get(key)
  if (hit) return hit
  const loader = glob[key]
  if (!loader) return null
  const promise = loadWithRetry(() => loader())
  cssSourceCache.set(key, promise)
  return promise
}

/* Per-demo variants derived from the glob keyset. Built once at module init since import.meta.glob is build-time. */
const availableVariantsByPath = (() => {
  const map = new Map<string, string[]>()
  for (const key of Object.keys(componentModules)) {
    /* key shape: ../../demos/solid/<path>/<variant>/index.tsx */
    const match = key.match(/^\.\.\/\.\.\/demos\/solid\/(.+)\/(css-modules|tailwind)\/index\.tsx$/)
    if (!match) continue
    const path = match[1] ?? ""
    const variantSubdir = match[2] ?? ""
    const variantName = variantSubdir === "tailwind" ? "Tailwind" : "CssModules"
    const list = map.get(path) ?? []
    if (!list.includes(variantName)) list.push(variantName)
    map.set(path, list)
  }
  /* Sort consistently: CssModules first then Tailwind */
  for (const [path, list] of map) {
    list.sort((a, b) => {
      if (a === "CssModules") return -1
      if (b === "CssModules") return 1
      return 0
    })
    map.set(path, list)
  }
  return map
})()

function getVariantsForPath(path: string): string[] {
  const list = availableVariantsByPath.get(path)
  if (list && list.length > 0) return list
  /* legacy single-file demos with no variant subdir */
  if (componentModules[`../../demos/solid/${path}/index.tsx`]) return ["CssModules"]
  return []
}

/* Retry transient dynamic-import failures (vite dev `Failed to fetch dynamically imported module`
   when the dev server gets clobbered by parallel preloads / network blips). Two retries with
   linear backoff covers virtually every flake without masking real syntax errors. */
async function loadWithRetry<T>(loader: () => Promise<T>, attempts = 3, baseMs = 150): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await loader()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * (i + 1)))
    }
  }
  throw lastErr
}

/* Cache `lazy()` refs across route nav — without this each mount creates a new lazy → fresh Suspense fallback fires even on cached modules → flash on every click. */
const lazyCache = new Map<string, ReturnType<typeof lazy>>()
function cachedLazy(key: string) {
  const hit = lazyCache.get(key)
  if (hit) return hit
  const loader = componentModules[key]
  if (!loader) return null
  const Lazy = lazy(async () => {
    const mod = await loadWithRetry(() => loader())
    return { default: (mod.default ?? (Object.values(mod)[0] as Component)) as Component }
  })
  lazyCache.set(key, Lazy)
  return Lazy
}

const sourceCache = new Map<string, Promise<HighlightedSource>>()
function cachedSource(key: string): Promise<HighlightedSource> | null {
  const hit = sourceCache.get(key)
  if (hit) return hit
  const loader = sourceModules[key]
  if (!loader) return null
  const promise = loadWithRetry(() => loader())
  sourceCache.set(key, promise)
  return promise
}

function variantSubdir(variant: string) {
  return variant === "Tailwind" ? "tailwind" : "css-modules"
}

function resolveComponentKey(path: string, variant: string) {
  return `../../demos/solid/${path}/${variantSubdir(variant)}/index.tsx`
}

function resolveLegacyKey(path: string) {
  return `../../demos/solid/${path}/index.tsx`
}

function countLines(text: string) {
  if (!text) return 0
  const parts = text.split("\n")
  if (text.endsWith("\n")) parts.pop()
  return parts.length
}

/** Bespoke Solid port of upstream `useDemo`. Variant discovery via import.meta.glob keyset —
    exposes CssModules + Tailwind when both exist for a path, single variant otherwise.
    Reads selected variant from DemoVariantSelectorContext (localStorage-persisted). */
export function useDemo(props: UseDemoProps, options: UseDemoOptions = {}): DemoApi {
  const [expanded, setExpanded] = createSignal(options.defaultOpen ?? false)
  const [selectedTransform, setSelectedTransform] = createSignal<string | null>(null)

  const ctx = useContext(DemoVariantSelectorContext)
  const variants = getVariantsForPath(props.path)

  const resolvedSelectedVariant = createMemo(() => {
    const stored = ctx?.selectedVariant() ?? null
    /* If stored variant exists and is available for this demo, use it. Otherwise fall back to first available. */
    if (stored && variants.includes(stored)) return stored
    return variants[0] ?? "CssModules"
  })

  function applySelectVariant(value: string) {
    if (ctx) ctx.setSelectedVariant(value)
  }

  const key = createMemo(() => {
    const variant = resolvedSelectedVariant()
    const variantKey = resolveComponentKey(props.path, variant)
    if (componentModules[variantKey]) return variantKey
    return resolveLegacyKey(props.path)
  })

  const LazyComponent = createMemo(() => cachedLazy(key()))

  const [source, setSource] = createSignal<HighlightedSource | undefined>(undefined)
  /* Keyed by display name ("index.module.css", "theme.css") → highlighted CSS source. */
  const [cssSources, setCssSources] = createSignal<Record<string, HighlightedSource>>({})

  createEffect(key, (k) => {
    const promise = cachedSource(k)
    if (!promise) {
      setSource(undefined)
      return
    }
    promise.then(setSource).catch(() => setSource(undefined))
  })

  /* Load the CSS module the demo actually imports. Shared `_index.module.css` is
     shown as `index.module.css`, matching the React docs file tab. */
  createEffect(
    () => resolvedSelectedVariant(),
    (variant) => {
      if (variant !== "CssModules") {
        setCssSources({})
        return
      }
      const localKey = `../../demos/solid/${props.path}/${variantSubdir(variant)}/index.module.css`
      const localPromise = cachedCssSource(localKey, variantCssSources)
      const sharedPromise = cachedCssSource(sharedModuleKey(props.path), sharedModuleSources)
      const promise = localPromise ?? sharedPromise
      if (!promise) {
        setCssSources({})
        return
      }
      promise
        .then((css) => setCssSources({ "index.module.css": css }))
        .catch(() => setCssSources({}))
    },
  )

  const [selectedFileName, setSelectedFileName] = createSignal<string | undefined>(undefined)

  /* Reset selected file tab when variant changes. */
  createEffect(
    () => resolvedSelectedVariant(),
    () => {
      setSelectedFileName(undefined)
    },
  )

  const fileName = () => {
    const segs = props.path.split("/")
    return `${segs[segs.length - 1] || "index"}.tsx`
  }

  const lang = createMemo(() => fileNameToLanguage(fileName()))

  function makeCssFile(name: string, css: HighlightedSource): DemoFile {
    return {
      html: css.html,
      lang: "css",
      lines: countLines(css.text),
      name,
      text: css.text,
    }
  }

  /* Returns plain data only — never JSX. JSX inside createMemo runs eagerly during
     hydration and consumes hydration markers from the wrong context, which silently
     trips a hydration mismatch and crashes the next Dynamic render with
     `template2 is not a function`. Consumers (DemoCodeBlock) own the JSX. */
  const files = createMemo<DemoFile[]>(() => {
    const tsx = source()
    const tsxFile: DemoFile = {
      html: tsx?.html,
      lang: lang(),
      lines: countLines(tsx?.text ?? ""),
      name: "index.tsx",
      slug: props.slug,
      text: tsx?.text ?? "",
    }
    if (resolvedSelectedVariant() !== "CssModules") return [tsxFile]
    const moduleCss = cssSources()["index.module.css"]
    if (!moduleCss) return [tsxFile]
    return [tsxFile, makeCssFile("index.module.css", moduleCss)]
  })

  /* SSR-gated demo render. Primitives (Toast Portal, Floating UI portal node) touch `document` in component bodies — crashes Solid SSR.
     Upstream React uses 'use client'; Solid has no equivalent, so defer demo evaluation until after hydration completes.
     mounted=false at SSR + first client render keeps hydration markers aligned; flips post-hydrate so portals run safely. */
  const [mounted, setMounted] = createSignal(false)
  onSettled(() => {
    setMounted(true)
  })
  const component = (
    <Show when={mounted() && LazyComponent()}>
      <Loading fallback={null}>
        <Dynamic component={LazyComponent() as Component} />
      </Loading>
    </Show>
  )

  function copy() {
    const list = files()
    const name = selectedFileName()
    const text = (name ? list.find((file) => file.name === name) : undefined)?.text ?? list[0]?.text ?? ""
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => options.copy?.onCopied?.())
    }
  }

  function expand() {
    setExpanded(true)
  }

  function openStackBlitz() {
    /* StackBlitz integration deferred per spec Decision — no-op. */
  }

  function openCodeSandbox() {
    /* CodeSandbox integration deferred per spec Decision — no-op. */
  }

  const activeFile = createMemo(() => {
    const list = files()
    const name = selectedFileName()
    return (name ? list.find((f) => f.name === name) : undefined) ?? list[0]
  })

  /* Always resolves to a concrete file name so Tabs.Root stays controlled — undefined would leave Tabs uncontrolled and ignore subsequent selectFileName() calls. */
  const resolvedSelectedFileName = createMemo(() => activeFile()?.name)

  /* SSR sees lines from synchronously-loaded source; client hydration starts with 0 (async glob).
     Mismatch flips DemoCodeBlock's `Show when={lines >= 12}` branch and crashes hydration with
     `template2 is not a function`. Force 0 until mounted so SSR + hydration agree. */
  const selectedFileLines = createMemo(() => (mounted() ? (activeFile()?.lines ?? 0) : 0))

  return {
    allFilesSlugs: () =>
      files()
        .map((f) => (f.slug ? { slug: f.slug } : null))
        .filter(Boolean) as { slug: string }[],
    availableTransforms: [],
    component,
    copy,
    expand,
    expanded,
    files,
    openCodeSandbox,
    openStackBlitz,
    selectFileName: (name: string) => setSelectedFileName(name),
    selectTransform: (v: string | null) => setSelectedTransform(v),
    selectVariant: applySelectVariant,
    selectedFile: activeFile,
    selectedFileLines,
    selectedFileName: resolvedSelectedFileName,
    selectedTransform,
    selectedVariant: resolvedSelectedVariant,
    setExpanded,
    variants,
  }
}
