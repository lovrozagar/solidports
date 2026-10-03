import { createMemo, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Tabs } from "@solidports/base-ui/tabs"

interface DemoFileSelectorFile {
  name: string
  slug?: string
}

interface DemoFileSelectorProps {
  files: DemoFileSelectorFile[]
  selectedFileName: string | undefined
  selectFileName: (fileName: string) => void
  onTabChange?: () => void
}

export function DemoFileSelector(props: DemoFileSelectorProps) {
  let modifierKeysPressed = false

  const tabs = createMemo(() =>
    props.files.map(({ name, slug }) => ({ id: name, name, slug })),
  )

  function onValueChange(value: string) {
    /* Ignore value changes triggered by Ctrl/Cmd-click (user opens in new tab). */
    if (modifierKeysPressed) return
    props.selectFileName(value)
    props.onTabChange?.()
  }

  function onTabPointerDown(event: PointerEvent) {
    modifierKeysPressed = event.ctrlKey || event.metaKey
  }

  function onTabClick(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey) {
      queueMicrotask(() => {
        modifierKeysPressed = false
      })
    } else {
      event.preventDefault()
      modifierKeysPressed = false
    }
  }

  return (
    <Show
      when={props.files.length > 1}
      fallback={
        <Show when={props.files[0]}>
          {(file) => (
            <a class="DemoFilename" href={file().slug ? `#${file().slug}` : undefined}>
              {file().name}
            </a>
          )}
        </Show>
      }
    >
      <Tabs.Root
        class="DemoTabsRoot"
        value={props.selectedFileName}
        onValueChange={onValueChange}
      >
        <Tabs.List class="DemoTabsList" aria-label="Files">
          {/* Keyed by file name: the tab list is rebuilt from the files, and a tab keeps its element. */}
          <For each={tabs()} keyed={(tab) => tab.id}>
            {(tab) => (
              <Tabs.Tab
                render={(tabProps) => {
                  const merged = tabProps as JSX.AnchorHTMLAttributes<HTMLAnchorElement>
                  return (
                    <a
                      {...merged}
                      href={tab().slug ? `#${tab().slug}` : undefined}
                      onClick={(event) => {
                        /* Tabs.Tab's internal click handler triggers value change — must run BEFORE preventDefault. */
                        const innerOnClick = merged.onClick
                        if (typeof innerOnClick === "function") innerOnClick(event)
                        onTabClick(event)
                      }}
                    >
                      {/* Span paints above the active tab's ::before fill. */}
                      <span>{tab().name}</span>
                    </a>
                  )
                }}
                class="DemoTab"
                value={tab().id}
                nativeButton={false}
                onPointerDown={onTabPointerDown}
              />

            )}
          </For>
        </Tabs.List>
      </Tabs.Root>
    </Show>
  )
}
