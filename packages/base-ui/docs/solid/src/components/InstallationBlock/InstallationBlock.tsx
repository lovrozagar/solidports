import { createMemo, createSignal, For, untrack } from 'solid-js';
import { createLayoutEffect, initialState } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { Tabs } from '@solidports/base-ui/tabs';
import { usePackageManagerSnippetContext } from 'docs/src/blocks/PackageManagerSnippet/PackageManagerSnippetProvider';
import * as CodeBlock from '../CodeBlock';
import { Code } from '../Code';
import { INSTALLATION_PACKAGE_MANAGERS } from './model';
import './InstallationBlock.css';

interface InstallationBlockProps {
  package: string;
  class?: string;
}
export function InstallationBlock(props: InstallationBlockProps) {
  const _usePackageManagerSnippetContext = usePackageManagerSnippetContext();
  const _usePackageManagerSnippetContext2 = createMemo(() => {
    const { packageManager: globalPreference, setPackageManager: setGlobalPreference } =
      _usePackageManagerSnippetContext();
    return {
      globalPreference,
      setGlobalPreference,
    };
  });
  const [value, setValue] = createSignal<string>(() =>
    untrack(() => initialState(INSTALLATION_PACKAGE_MANAGERS[0].value)),
  );
  createLayoutEffect(
    () => [_usePackageManagerSnippetContext2().globalPreference],
    () => {
      const _globalPreference = _usePackageManagerSnippetContext2().globalPreference;
      if (INSTALLATION_PACKAGE_MANAGERS.some((pm) => pm.value === _globalPreference)) {
        setValue(_globalPreference);
      }
    },
  );
  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    _usePackageManagerSnippetContext2().setGlobalPreference(newValue);
  };
  return (
    <Tabs.Root
      class={clsx('InstallationBlock', props.class)}
      value={value()}
      onValueChange={handleValueChange}
    >
      <CodeBlock.Root>
        <CodeBlock.Panel title="Installation command">
          <Tabs.List class="InstallationBlockTabsList" aria-label="Package manager" activateOnFocus>
            <For each={INSTALLATION_PACKAGE_MANAGERS}>
              {(pm) => (
                <Tabs.Tab value={pm.value} class="InstallationBlockTab">
                  <span>{pm.label}</span>
                </Tabs.Tab>
              )}
            </For>
          </Tabs.List>
        </CodeBlock.Panel>

        <For each={INSTALLATION_PACKAGE_MANAGERS}>
          {(pm) => (
            <Tabs.Panel value={pm.value} class="InstallationBlockTabPanel">
              <CodeBlock.Pre>
                <Code class="language-bash">
                  <span class="frame">
                    <span class="line">
                      <span class="pl-en">{pm.value}</span> <span class="pl-smi">{pm.command}</span>{' '}
                      <span class="pl-s">{props.package}</span>
                    </span>
                  </span>
                </Code>
              </CodeBlock.Pre>
            </Tabs.Panel>
          )}
        </For>
      </CodeBlock.Root>
    </Tabs.Root>
  );
}
