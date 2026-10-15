import type { JSX } from '@solidjs/web';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { TypesDataProvider } from '@mui/internal-docs-infra/useType';
import { PackageManagerSnippetProvider } from 'docs/src/blocks/PackageManagerSnippet/PackageManagerSnippetProvider';
import { CodeComponentsProvider } from 'docs/src/code-components';

export function DocsProviders(props: { children: JSX.Element }) {
  return (
    <Tooltip.Provider delay={350}>
      <CodeComponentsProvider>
        <TypesDataProvider>
          <PackageManagerSnippetProvider defaultValue="npm">
            {props.children}
          </PackageManagerSnippetProvider>
        </TypesDataProvider>
      </CodeComponentsProvider>
    </Tooltip.Provider>
  );
}
