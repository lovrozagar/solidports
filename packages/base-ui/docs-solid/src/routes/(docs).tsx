import { For, onMount, Show, Suspense, type ParentProps } from "solid-js"
import { useLocation, usePreloadRoute } from "@solidjs/router"
import { GoogleAnalytics } from "../components/GoogleAnalytics"
import { DocsProviders } from "../components/DocsProviders"
import * as SideNav from "../components/SideNav"
import * as QuickNav from "../components/QuickNav/QuickNav"
import { Header, titleMap } from "../components/Header"
import { MAIN_CONTENT_ID } from "../components/SkipNav"
import { sitemap } from "../sitemap"
import "../styles.css"
import "./(docs)/layout.css"

/* Sequential, throttled background warm-up of every sidebar route. Solid Router only
   preloads on hover by default — first click on an unhovered link hits a cold chunk
   (~50–100ms blank in dev). Earlier attempt parallel-fired all 51 routes at once and
   thrashed the dev server. This version walks one route at a time during browser idle,
   yielding to navigation: skips the current route, defers when a click is in flight. */
function startBackgroundPreload(
  preload: ReturnType<typeof usePreloadRoute>,
  getCurrentPath: () => string,
) {
  if (typeof window === "undefined") return
  const queue: string[] = []
  for (const section of Object.values(sitemap.data)) {
    for (const page of section.pages) {
      if (page.tags?.includes("External")) continue
      const href = page.path.startsWith("./")
        ? `${section.prefix}${page.path.replace(/^\.\//, "").replace(/\/page\.mdx$/, "")}`
        : page.path
      queue.push(href)
    }
  }
  const idle: typeof requestIdleCallback =
    "requestIdleCallback" in window
      ? window.requestIdleCallback
      : ((cb: IdleRequestCallback) =>
          window.setTimeout(
            () => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline),
            120,
          )) as unknown as typeof requestIdleCallback

  /* One route per idle tick + 80ms gap. Faster (parallel-fire) overloads vite dev server
     → "Failed to fetch dynamically imported module" + chrome network-activation alerts.
     Throttled, sequential preload is slow but safe in dev; in prod chunks are pre-emitted
     and the whole queue drains in milliseconds. */
  function pumpOne() {
    if (queue.length === 0) return
    const next = queue.shift()
    if (next && next !== getCurrentPath()) preload(next, { preloadData: false })
    window.setTimeout(() => idle(() => pumpOne(), { timeout: 5000 }), 80)
  }

  /* Wait 1.5s after mount so the initial route + any user-triggered nav settle first. */
  window.setTimeout(() => idle(() => pumpOne(), { timeout: 5000 }), 1500)
}

export default function Layout(props: ParentProps) {
  const preload = usePreloadRoute()
  const location = useLocation()
  onMount(() => startBackgroundPreload(preload, () => location.pathname))
  return (
    <GoogleAnalytics>
      <DocsProviders>
        <div class="RootLayout">
          <div class="RootLayoutContainer">
            <div class="RootLayoutContent">
              <div class="ContentLayoutRoot">
                <Header />
                <SideNav.Root>
                  <Show when={sitemap}>
                    <For each={Object.entries(sitemap.data)}>
                      {([name, section]) => (
                        <SideNav.Section>
                          <SideNav.Heading>{name}</SideNav.Heading>
                          <SideNav.List>
                            <For each={section.pages}>
                              {(page) => {
                                const isNew = () =>
                                  page.isNew ?? page.tags?.includes("New")
                                const isPreview = () =>
                                  page.isPreview ?? page.tags?.includes("Preview")
                                return (
                                  <SideNav.Item
                                    href={
                                      page.path.startsWith("./")
                                        ? `${section.prefix}${page.path.replace(/^\.\//, "").replace(/\/page\.mdx$/, "")}`
                                        : page.path
                                    }
                                    external={page.tags?.includes("External")}
                                  >
                                    {titleMap[page.title] || page.title}
                                    <Show when={isPreview()}>
                                      <SideNav.Badge>Preview</SideNav.Badge>
                                    </Show>
                                    <Show when={isNew() && !isPreview()}>
                                      <SideNav.Badge>New</SideNav.Badge>
                                    </Show>
                                  </SideNav.Item>
                                )
                              }}
                            </For>
                          </SideNav.List>
                        </SideNav.Section>
                      )}
                    </For>
                  </Show>
                </SideNav.Root>

                <main class="ContentLayoutMain" id={MAIN_CONTENT_ID}>
                  <QuickNav.Container>
                    {/* Local Suspense so only main content suspends on nav — header + sidenav stay
                        mounted. Solid Router runs nav inside startTransition, so the *previous*
                        route's content keeps rendering here until the next route's resources
                        resolve, eliminating the black-flash gap. */}
                    <Suspense>{props.children}</Suspense>
                  </QuickNav.Container>
                </main>
              </div>
            </div>
            <span class="RootLayoutFooter" />
          </div>
        </div>
      </DocsProviders>
    </GoogleAnalytics>
  )
}
