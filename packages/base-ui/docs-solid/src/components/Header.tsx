import { For, Show } from "solid-js"
import { A } from "@solidjs/router"
import { GitHubIcon } from "../icons/GitHubIcon"
import { NpmIcon } from "../icons/NpmIcon"
import * as MobileNav from "./MobileNav"
import { sitemap } from "../sitemap"
import { Logo } from "./Logo"
import { SkipNav } from "./SkipNav"
import { Search } from "./Search"

export const titleMap: Record<string, string> = {
  "About Base\xa0UI": "About",
}

export const HEADER_HEIGHT = 48

const LIB_VERSION = (import.meta.env?.VITE_LIB_VERSION as string | undefined) ?? "0.0.0"

export function Header() {
  return (
    <header class="Header">
      <div class="HeaderInner">
        <SkipNav>Skip to contents</SkipNav>
        <A href="/" class="HeaderLogoLink">
          <Logo aria-label="Base UI" />
        </A>
        <div class="flex gap-6 max-show-side-nav:hidden">
          <Search containedScroll enableKeyboardShortcut />
          <a
            class="HeaderLink"
            href="https://www.npmjs.com/package/@solidports/base-ui"
            rel="noopener"
          >
            <NpmIcon />
            {LIB_VERSION}
          </a>
          <a class="HeaderLink" href="https://github.com/mui/base-ui" rel="noopener">
            <GitHubIcon />
            GitHub
          </a>
        </div>
        <div class="flex items-center gap-2 show-side-nav:hidden">
          <div class="flex pr-4 pl-4">
            <Search />
          </div>
          <Show when={sitemap}>
            <MobileNav.Root>
              <MobileNav.Trigger class="HeaderButton whitespace-nowrap">
                <span class="flex w-4 flex-col items-center gap-1">
                  <span class="h-0.5 w-3.5 bg-current" />
                  <span class="h-0.5 w-3.5 bg-current" />
                </span>
                Navigation
              </MobileNav.Trigger>
              <MobileNav.Portal>
                <MobileNav.Backdrop />
                <MobileNav.Popup>
                  <For each={Object.entries(sitemap.data)}>
                    {([name, section]) => (
                      <MobileNav.Section>
                        <MobileNav.Heading>{name}</MobileNav.Heading>
                        <MobileNav.List>
                          <For each={section.pages}>
                            {(page) => (
                              <MobileNav.Item
                                href={
                                  page.path.startsWith("./")
                                    ? `${section.prefix}${page.path.replace(/^\.\//, "").replace(/\/page\.mdx$/, "")}`
                                    : page.path
                                }
                                external={page.tags?.includes("External")}
                              >
                                {titleMap[page.title] || page.title}
                                <Show when={page.tags?.includes("New")}>
                                  <MobileNav.Badge>New</MobileNav.Badge>
                                </Show>
                                <Show when={page.tags?.includes("Preview")}>
                                  <MobileNav.Badge>Preview</MobileNav.Badge>
                                </Show>
                              </MobileNav.Item>
                            )}
                          </For>
                        </MobileNav.List>
                      </MobileNav.Section>
                    )}
                  </For>
                  <MobileNav.Section>
                    <MobileNav.Heading>Resources</MobileNav.Heading>
                    <MobileNav.List>
                      <MobileNav.Item
                        href="https://www.npmjs.com/package/@solidports/base-ui"
                        rel="noopener"
                        external
                      >
                        <NpmIcon />
                        <span class="flex flex-grow-1 items-baseline justify-between">
                          npm package
                          <span class="text-md text-gray-600">{LIB_VERSION}</span>
                        </span>
                      </MobileNav.Item>
                      <MobileNav.Item
                        href="https://github.com/mui/base-ui"
                        rel="noopener"
                        external
                      >
                        <GitHubIcon class="mt-[-2px]" />
                        GitHub
                      </MobileNav.Item>
                    </MobileNav.List>
                  </MobileNav.Section>
                </MobileNav.Popup>
              </MobileNav.Portal>
            </MobileNav.Root>
          </Show>
        </div>
      </div>
    </header>
  )
}
