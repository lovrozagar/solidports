import { For, Show, Loading } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { GoogleAnalytics } from "../components/GoogleAnalytics"
import { DocsProviders } from "../components/DocsProviders"
import * as SideNav from "../components/SideNav"
import * as QuickNav from "../components/QuickNav/QuickNav"
import { Header, titleMap } from "../components/Header"
import { MAIN_CONTENT_ID } from "../components/SkipNav"
import { sitemap } from "../sitemap"
import { GitHubIcon } from "../icons/GitHubIcon"
import { NpmIcon } from "../icons/NpmIcon"
import "./(docs)/layout.css"

/* Match the React docs snapshot badge. The Solid package version is 1.8.0-sp.1. */
const LIB_VERSION = "1.8.0"

export default function Layout(props: ParentProps) {
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
                                const href = page.path.startsWith("./")
                                  ? `${section.prefix}${page.path.replace(/^\.\//, "").replace(/\/page\.mdx$/, "")}`
                                  : page.path
                                const isNew = page.isNew ?? page.tags?.includes("New")
                                const isPreview = page.isPreview ?? page.tags?.includes("Preview")
                                return (
                                  <SideNav.Item
                                    href={href}
                                    external={page.tags?.includes("External")}
                                  >
                                    {titleMap[page.title] || page.title}
                                    <Show when={isPreview}>
                                      <SideNav.Badge>Preview</SideNav.Badge>
                                    </Show>
                                    <Show when={isNew && !isPreview}>
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
                  <SideNav.Separator />
                  <SideNav.Section>
                    <SideNav.List>
                      <SideNav.Item
                        href="https://github.com/mui/base-ui"
                        external
                        icon={GitHubIcon}
                      >
                        GitHub
                      </SideNav.Item>
                      <SideNav.Item
                        href="https://www.npmjs.com/package/@solidports/base-ui"
                        external
                        icon={NpmIcon}
                      >
                        <span>
                          npm
                          <span class="SideNavVersion">{LIB_VERSION}</span>
                        </span>
                      </SideNav.Item>
                    </SideNav.List>
                  </SideNav.Section>
                </SideNav.Root>

                <main class="ContentLayoutMain" id={MAIN_CONTENT_ID}>
                  <QuickNav.Container>
                    {/* Local Loading so only main content suspends on nav — header + sidenav stay
                        mounted. Solid 2 keeps the previous route visible until the next route is
                        ready, so this boundary covers first-load lazy chunks without a blank gap. */}
                    <Loading>{props.children}</Loading>
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
