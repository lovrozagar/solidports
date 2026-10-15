import { createMemo, createSignal, For, onSettled } from 'solid-js';
import { useSyncExternalStore } from 'docs/src/adapters/react';
import type { EnhancedTypesMeta } from '@mui/internal-docs-infra/useTypes';
import { Link } from '../Link';
import { Code } from '../Code';
import * as CodeBlock from '../CodeBlock';

export function AdditionalTypes(props: {
  data: EnhancedTypesMeta[];
  multiple?: boolean;
  show?: string[];
}) {
  const rawTypes = createMemo(() => props.data.filter((t) => t.type === 'raw'));
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [canGoBack, setCanGoBack] = createSignal(false);
  onSettled(() => {
    const handleHashChange = () => setCanGoBack(true);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
  const handleBack = (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    event.preventDefault();
    history.back();
  };
  return (
    <>
      <For each={rawTypes()}>
        {(additionalType) => (
          <div
            id={additionalType.slug}
            class="AdditionalTypeWrapper"
            data-shown={
              additionalType.slug && props.show?.includes(additionalType.slug) ? 'true' : undefined
            }
          >
            <h3 class="ReferenceSectionHeading AdditionalTypeHeading">
              {additionalType.name}
              <a
                href="#"
                class="AdditionalTypeBackLink"
                data-hidden={
                  additionalType.slug && props.show?.includes(additionalType.slug)
                    ? 'true'
                    : undefined
                }
                onClick={hydrated() && canGoBack() ? handleBack : undefined}
              >
                {hydrated() && canGoBack() ? 'Back' : 'Hide'}
              </a>
            </h3>
            {additionalType.data.reExportOf ? (
              <p class="AdditionalTypeReExport">
                Re-Export of{' '}
                <Link
                  href={props.multiple ? additionalType.data.reExportOf.slug : '#api-reference'}
                >
                  {additionalType.data.reExportOf.name}
                </Link>{' '}
                {additionalType.data.reExportOf.suffix} as{' '}
                <Code>
                  <span class="pl-en">{additionalType.name.replaceAll('.', '')}</span>
                </Code>
              </p>
            ) : (
              <CodeBlock.Root class="AdditionalTypeCodeBlock">
                {additionalType.data.formattedCode}
              </CodeBlock.Root>
            )}
          </div>
        )}
      </For>
    </>
  );
}
