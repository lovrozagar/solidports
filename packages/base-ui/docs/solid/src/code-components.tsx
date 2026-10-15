import type { JSX } from '@solidjs/web';
import { CodeComponentsContext } from '@mui/internal-docs-infra/useCode';
import type { MDXComponents } from 'docs/src/adapters/mdx-types';
import { Link } from './components/Link';
import { TypeRef } from './components/TypeRef';
import { TypePropRef } from './components/TypePropRef';

export const codeComponents: MDXComponents = {
  a: Link,
  TypeRef,
  TypePropRef,
};
export function CodeComponentsProvider(props: { children: JSX.Element }) {
  return (
    <CodeComponentsContext value={() => codeComponents}>{props.children}</CodeComponentsContext>
  );
}
