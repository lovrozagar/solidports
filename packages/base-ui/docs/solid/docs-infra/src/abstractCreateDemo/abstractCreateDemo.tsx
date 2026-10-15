// docs-infra's `abstractCreateDemo`, kept by hand for Solid: demos render their precomputed code.
// Each variant's demo is an element created where it is placed, so only the selected variant
// renders and it is built once per selection.
import { createComponent, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ComponentType } from 'docs/src/adapters/react';
import { element } from 'docs/src/adapters/react';
import { CodeHighlighter } from '../CodeHighlighter';
import type { Code, CodeHighlighterProps, ContentProps } from '../CodeHighlighter/types';
import { createDemoDataWithVariants } from '../createDemoData';
import { resolveDemoFlag } from './resolveDemoFlag';

type DemoControlProps = {
  collapseToEmpty?: boolean;
  showCollapsedFocus?: boolean;
  initialExpanded?: boolean;
  initialCollapsed?: boolean;
  initialDisabled?: boolean;
};

type CreateDemoMeta = {
  name?: string;
  slug?: string;
  displayName?: string;
  variantType?: string;
  skipPrecompute?: boolean;
  highlightAfter?: CodeHighlighterProps<{}>['highlightAfter'];
  enhanceAfter?: CodeHighlighterProps<{}>['enhanceAfter'];
  precompute?: Code;
  collapseToEmpty?: boolean;
  showCollapsedFocus?: boolean;
  initialExpanded?: boolean;
  initialCollapsed?: boolean;
  initialDisabled?: boolean;
};

type AbstractCreateDemoOptions<T extends {}> = {
  DemoContent: ComponentType<ContentProps<T>>;
  DemoTitle?: ComponentType<{ slug?: string; children?: string }>;
  /** Variant types by their sorted, `:`-joined variant names (the preference they share). */
  variantTypes?: Record<string, string>;
  highlightAfter?: CodeHighlighterProps<{}>['highlightAfter'];
  enhanceAfter?: CodeHighlighterProps<{}>['enhanceAfter'];
  collapseToEmpty?: boolean;
  initialExpanded?: boolean;
  initialDisabled?: boolean;
};

export function abstractCreateDemo<T extends {}>(
  options: AbstractCreateDemoOptions<T>,
  url: string,
  variants: { [key: string]: ComponentType },
  meta: CreateDemoMeta | undefined,
): ComponentType<T & DemoControlProps> & { Title: ComponentType } {
  const demoData = createDemoDataWithVariants(url, variants, meta);
  const variantType =
    options.variantTypes && options.variantTypes[Object.keys(variants).sort().join(':')];

  function DemoComponent(props: T & DemoControlProps): JSX.Element {
    // Each variant's demo, created when the demo shows it.
    const renderedComponents: Record<string, JSX.Element> = {};
    for (const [key, Component] of Object.entries(demoData.components)) {
      renderedComponents[key] = element(() => createComponent(Component, {}));
    }
    const restProps = omit(
      props,
      'collapseToEmpty',
      'showCollapsedFocus',
      'initialExpanded',
      'initialCollapsed',
      'initialDisabled',
    );
    const flags = untrack(() => ({
      collapseToEmpty: resolveDemoFlag(
        [
          { on: props.collapseToEmpty, off: props.showCollapsedFocus },
          { on: meta?.collapseToEmpty, off: meta?.showCollapsedFocus },
        ],
        options.collapseToEmpty,
      ),
      initialExpanded: resolveDemoFlag(
        [
          { on: props.initialExpanded, off: props.initialCollapsed },
          { on: meta?.initialExpanded, off: meta?.initialCollapsed },
        ],
        options.initialExpanded,
      ),
      initialDisabled: resolveDemoFlag(
        [{ on: props.initialDisabled }, { on: meta?.initialDisabled }],
        options.initialDisabled,
      ),
    }));
    return (
      <div class="demo">
        <CodeHighlighter
          url={demoData.url}
          name={demoData.name}
          slug={demoData.slug}
          variantType={meta?.variantType || variantType}
          precompute={demoData.precompute}
          components={renderedComponents}
          contentProps={restProps as unknown as T}
          collapseToEmpty={flags.collapseToEmpty}
          initialExpanded={flags.initialExpanded}
          initialDisabled={flags.initialDisabled}
          Content={options.DemoContent}
          highlightAfter={meta?.highlightAfter || options.highlightAfter}
          enhanceAfter={meta?.enhanceAfter || options.enhanceAfter}
        />
      </div>
    );
  }

  function Title(): JSX.Element {
    if (options.DemoTitle) {
      return <options.DemoTitle slug={demoData.slug}>{demoData.name}</options.DemoTitle>;
    }
    return <h3 id={demoData.slug}>{demoData.name}</h3>;
  }
  DemoComponent.Title = Title;
  return DemoComponent;
}

export function createDemoFactory<T extends {}>(options: AbstractCreateDemoOptions<T>) {
  return (url: string, component: ComponentType, meta?: CreateDemoMeta) =>
    // Precomputed code keys a single component as `Default`.
    abstractCreateDemo(options, url, { Default: component }, meta);
}

export function createDemoWithVariantsFactory<T extends {}>(options: AbstractCreateDemoOptions<T>) {
  return (url: string, variants: Record<string, ComponentType>, meta?: CreateDemoMeta) =>
    abstractCreateDemo(options, url, variants, meta);
}
