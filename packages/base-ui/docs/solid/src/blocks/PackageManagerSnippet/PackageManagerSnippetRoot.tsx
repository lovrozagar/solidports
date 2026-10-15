import { createMemo, createSignal, For, untrack } from 'solid-js';
import { createLayoutEffect, initialState } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import { Tabs } from '@solidports/base-ui/tabs';
import { usePackageManagerSnippetContext } from './PackageManagerSnippetProvider';

export function PackageManagerSnippetRoot(props: PackageManagerSnippetRoot.Props) {
  const _usePackageManagerSnippetContext = usePackageManagerSnippetContext();
  const _usePackageManagerSnippetContext2 = createMemo(() => {
    const { packageManager: globalPreference, setPackageManager: setGlobalPreference } =
      _usePackageManagerSnippetContext();
    return {
      globalPreference,
      setGlobalPreference,
    };
  });
  const [value, setValue] = createSignal(() => untrack(() => initialState(props.options[0].value)));
  const handleValueChange = (newValue: string) => {
    _usePackageManagerSnippetContext2().setGlobalPreference(newValue);
  };
  createLayoutEffect(
    () => [props.options, _usePackageManagerSnippetContext2().globalPreference],
    () => {
      const _globalPreference = _usePackageManagerSnippetContext2().globalPreference;
      if (props.options.some((option) => option.value === _globalPreference)) {
        setValue(_globalPreference);
      }
    },
  );
  return (
    <Tabs.Root value={value()} onValueChange={handleValueChange}>
      <Tabs.List render={props.renderTabsList} aria-label="Package manager selector">
        <For each={props.options}>
          {(option) => (
            <Tabs.Tab value={option.value} render={props.renderTab}>
              {option.label}
            </Tabs.Tab>
          )}
        </For>
      </Tabs.List>
      {props.children}
    </Tabs.Root>
  );
}
export namespace PackageManagerSnippetRoot {
  export type Props = {
    children: JSX.Element;
    options: Array<{
      value: string;
      label: string;
    }>;
    renderTab?: Tabs.Tab.Props['render'];
    renderTabsList?: Tabs.List.Props['render'];
  };
}
