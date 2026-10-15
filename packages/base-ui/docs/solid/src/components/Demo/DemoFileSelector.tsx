import { createMemo, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Tabs } from '@solidports/base-ui/tabs';

interface DemoFileSelectorProps {
  files: Array<{
    name: string;
    slug?: string;
    component: JSX.Element;
  }>;
  selectedFileName: string | undefined;
  selectFileName: (fileName: string) => void;
  onTabChange?: () => void;
}
type Tab = {
  id: string;
  name: string;
  slug?: string;
};
export function DemoFileSelector(props: DemoFileSelectorProps) {
  const tabs = createMemo<Tab[]>(() =>
    props.files.map(({ name, slug }) => ({
      id: name,
      name,
      slug,
    })),
  );
  const modifierKeysRef = {
    current: false,
  };
  const onValueChange = (value: string) => {
    // Don't change tab if modifier keys were pressed (user is opening in new tab)
    if (modifierKeysRef.current) {
      return;
    }
    props.selectFileName(value);
    props.onTabChange?.();
  };
  const onTabPointerDown = (
    event: PointerEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    // Track modifier keys before focus event fires
    modifierKeysRef.current = event.ctrlKey || event.metaKey;
  };
  const onTabClick = (
    event: MouseEvent & {
      currentTarget: HTMLAnchorElement;
      target: Element;
    },
  ) => {
    // Allow Ctrl+Click (or Cmd+Click on Mac) to open in new tab
    if (event.ctrlKey || event.metaKey) {
      // Reset modifier keys flag after all event handlers complete
      queueMicrotask(() => {
        modifierKeysRef.current = false;
      });
    } else {
      // Prevent scroll jump to anchor
      event.preventDefault();
      modifierKeysRef.current = false;
    }
  };
  const _render = createMemo(() => {
    if (props.files.length <= 1) {
      return null;
    }
    return (
      <Tabs.Root class="DemoTabsRoot" value={props.selectedFileName} onValueChange={onValueChange}>
        <Tabs.List class="DemoTabsList" aria-label="Files">
          <For each={tabs()}>
            {(tab: Tab) => (
              <Tabs.Tab
                render={{
                  component: 'a',
                  get href() {
                    return tab.slug ? `#${tab.slug}` : undefined;
                  },
                  onClick: onTabClick,
                }}
                class="DemoTab"
                value={tab.id}
                nativeButton={false}
                onPointerDown={onTabPointerDown}
              >
                <span>{tab.name}</span>
              </Tabs.Tab>
            )}
          </For>
        </Tabs.List>
      </Tabs.Root>
    );
  });
  return <>{_render()}</>;
}
