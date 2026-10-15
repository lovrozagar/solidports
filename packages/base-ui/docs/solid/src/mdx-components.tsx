import { element, place } from 'docs/src/adapters/react';
import { createMemo, merge, omit } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import type { Accessor } from 'solid-js';
import type { ComponentType, ReactProps } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import clsx from 'clsx';
import * as CodeBlock from './components/CodeBlock';
import * as Table from './components/Table';
import * as QuickNav from './components/QuickNav/QuickNav';
import { Code } from './components/Code';
import { Link } from './components/Link';
import { HeadingLink } from './components/HeadingLink';
import { Subtitle } from './components/Subtitle/Subtitle';
import { TypeRef } from './components/TypeRef';
import { TypePropRef } from './components/TypePropRef';
import { Kbd } from './components/Kbd/Kbd';
import { CodeBlockPreComputed } from './components/CodeBlock/CodeBlockPreComputed';
import './css/mdx-components.css';

interface MDXComponents {
  [key: string]: ComponentType<any> | MDXComponents;
}
type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
function HeadingBadge(props: { children: JSX.Element }) {
  return <span class="MdHeadingBadge">{props.children}</span>;
}
function Heading(
  _props: ReactProps<ComponentProps<HeadingLevel>> & {
    as: HeadingLevel;
    link?: boolean;
    'data-heading-badge'?: string;
  },
) {
  const props = merge(
    {
      link: false,
    },
    _props,
  );
  const rest = omit(props, 'as', 'class', 'children', 'id', 'link', 'data-heading-badge');
  const badge = createMemo(() => {
    const _value = props['data-heading-badge'];
    return _value ? element(() => <HeadingBadge>{_value}</HeadingBadge>) : null;
  });
  return (
    <Dynamic component={props.as} class={props.class} id={props.id} {...rest}>
      {props.link ? (
        <HeadingLink id={props.id}>
          {props.children}
          {place(badge())}
        </HeadingLink>
      ) : (
        <>
          {props.children}
          {place(badge())}
        </>
      )}
    </Dynamic>
  );
}

// Maintain spacing between MDX components here
export const mdxComponents: MDXComponents = {
  a: Link,
  em: (props) => <em class="MdEm" {...props} />,
  code: (props) => <Code {...props} class={clsx('MdCode', props.class)} />,
  h1: (props) => <Heading as="h1" class="MdH1" {...props} />,
  h2: (props) => <Heading as="h2" class="MdH2" link {...props} />,
  h3: (props) => <Heading as="h3" class="MdH3" link {...props} />,
  h4: (props) => <Heading as="h4" class="MdH4" {...props} />,
  h5: (props) => <Heading as="h5" class="MdH5" {...props} />,
  h6: (props) => <Heading as="h6" class="MdH6" {...props} />,
  p: (props) => <p class="MdP" {...props} />,
  li: (props) => <li class="MdListItem" {...props} />,
  ul: (props) => <ul class="MdUl" {...props} />,
  ol: (props) => <ol class="MdOl" {...props} />,
  kbd: Kbd,
  figure: (props) => <figure class="MdFigure" {...props} />,
  pre: (props) => {
    const rest = omit(props, 'tabIndex');
    const _render = createMemo(() => {
      if ('data-precompute' in rest) {
        return (
          <CodeBlock.Root class="MdFigure">
            <CodeBlockPreComputed {...rest} />
          </CodeBlock.Root>
        );
      }
      return <CodeBlock.Pre {...rest} />;
    });
    return <>{_render()}</>;
  },
  table: (props) => <Table.Root class="MdTable" {...props} />,
  thead: Table.Head,
  tbody: Table.Body,
  tr: Table.Row,
  th: (props: ReactProps<ComponentProps<'th'>>) => (
    <>
      {props.scope === 'row' ? <Table.RowHeader {...props} /> : <Table.ColumnHeader {...props} />}
    </>
  ),
  td: Table.Cell,
  // Custom components
  TypeRef,
  TypePropRef,
  QuickNav,
  Meta: (props: ReactProps<ComponentProps<'meta'>>) => {
    const _render2 = createMemo(() => {
      if (props.name === 'description' && String(props.content).length > 170) {
        throw new Error("Meta description shouldn't be longer than 170 chars");
      }
      // At build time, `transformMarkdownMetadata` extracts <Meta> attributes
      // and injects them as `export const metadata = { ... }` into the compiled
      // MDX. Next.js picks that export up and emits the <meta> tag itself, so
      // rendering one here would produce a duplicate.
      return null;
    });
    return <>{_render2()}</>;
  },
  Subtitle: (props) => <Subtitle {...props} />,
};
export function useMDXComponents(): Accessor<MDXComponents> {
  return createMemo(() => mdxComponents);
}
