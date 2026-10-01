import { For, createSignal } from 'solid-js';
import clsx from 'clsx';
import { Tabs } from '@solidports/base-ui/tabs';
import { usePackageManagerSnippet } from '../../blocks/PackageManagerSnippet/PackageManagerSnippetProvider';
import * as CodeBlock from '../CodeBlock';
import { Code } from '../Code';
import { INSTALLATION_PACKAGE_MANAGERS } from './model';
import './InstallationBlock.css';

interface InstallationBlockProps {
  package: string;
  class?: string;
  className?: string;
}

export function InstallationBlock(props: InstallationBlockProps) {
  const ctx = usePackageManagerSnippet();
  const [value, setValue] = createSignal<string>(
    ctx?.value() ?? INSTALLATION_PACKAGE_MANAGERS[0].value,
  );

  return (
    <Tabs.Root
      class={clsx('InstallationBlock', props.class ?? props.className)}
      value={value()}
      onValueChange={(next) => {
        setValue(next);
        if (next === 'npm' || next === 'pnpm' || next === 'yarn' || next === 'bun') {
          ctx?.setValue(next);
        }
      }}
    >
      <CodeBlock.Root>
        <CodeBlock.Panel title="Installation command">
          <Tabs.List class="InstallationBlockTabsList" aria-label="Package manager">
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
                      <span class="pl-en">{pm.value}</span> <span class="pl-smi">{pm.command}</span>{" "}
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
