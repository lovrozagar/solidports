// docs-infra's `useDemo`, kept by hand for Solid: `useCode` plus the selected variant's demo and
// the StackBlitz and CodeSandbox exports. Like `useCode`, it returns one object of getters.
import { createMemo, untrack, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import kebabCase from 'kebab-case';
import { useCode } from '../useCode';
import type { UseCodeOpts, UseCodeResult } from '../useCode';
import type { ContentProps, VariantCode } from '../CodeHighlighter/types';
import { CodeHighlighterContext } from '../CodeHighlighter/CodeHighlighterContext';
import { createStackBlitz } from './createStackBlitz';
import { createCodeSandbox } from './createCodeSandbox';
import { exportVariant } from './exportVariant';
import type { ExportConfig } from './exportVariant';
import { exportVariantAsCra } from './exportVariantAsCra';
import { flattenCodeVariant } from '../pipeline/loadIsomorphicCodeVariant/flattenCodeVariant';

export type UseDemoOpts = UseCodeOpts & {
  /** Export settings shared by StackBlitz and CodeSandbox. */
  export?: ExportConfig;
  exportStackBlitz?: ExportConfig;
  exportCodeSandbox?: ExportConfig;
};

export type UseDemoResult<T extends {} = {}> = UseCodeResult<T> & {
  /** The selected variant's demo, rendered where it is placed. */
  readonly component: JSX.Element;
  openStackBlitz: () => void;
  openCodeSandbox: () => void;
  readonly name: string | undefined;
  readonly slug: string | undefined;
};

function usesTypescript(variant: VariantCode): boolean {
  const fileNames = [variant.fileName, ...Object.keys(variant.extraFiles ?? {})];
  return fileNames.some((fileName) => fileName?.endsWith('.ts') || fileName?.endsWith('.tsx'));
}

export function addHiddenInput(form: HTMLFormElement, name: string, value: string): void {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/** Posts `formData` to `url` in a new tab through a temporary form. */
export function openWithForm({
  url,
  formData,
  method = 'POST',
  target = '_blank',
}: {
  url: string;
  formData: Record<string, string>;
  method?: string;
  target?: string;
}): void {
  const form = document.createElement('form');
  form.method = method;
  form.target = target;
  form.action = url;
  Object.entries(formData).forEach(([name, value]) => {
    addHiddenInput(form, name, value);
  });
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

export function useDemo<T extends {} = {}>(
  contentProps: Accessor<ContentProps<T>>,
  opts: Accessor<UseDemoOpts | undefined> = () => undefined,
): Accessor<UseDemoResult<T>> {
  const code = useCode(contentProps, opts)();
  const context = useContext(CodeHighlighterContext);

  const slug = createMemo(() => {
    const { slug: contentSlug, name } = contentProps();
    return contentSlug || (name ? kebabCase(name, false) : undefined);
  });
  const component = createMemo(() => {
    const components = context?.components || contentProps().components || {};
    return components[code.selectedVariant] ?? null;
  });

  /** The selected variant's code, as the exports take it. */
  const selectedVariantCode = (): VariantCode | null => {
    const variantCode = (context?.code || contentProps().code || {})[code.selectedVariant];
    return variantCode && typeof variantCode === 'object' ? variantCode : null;
  };

  const open = (
    target: 'StackBlitz' | 'CodeSandbox',
    defaultExport: typeof exportVariant,
    create: (
      title: string,
      description: string,
      exported: ReturnType<typeof exportVariant>,
    ) => Parameters<typeof openWithForm>[0],
  ) => {
    const variant = untrack(selectedVariantCode);
    if (!variant) {
      console.warn(`No valid variant code available for ${target} demo`);
      return;
    }
    const options = untrack(opts) ?? {};
    const title = untrack(contentProps).name || 'Demo';
    const description = `${title} demo`;
    const config: ExportConfig = {
      ...options.export,
      ...(target === 'StackBlitz' ? options.exportStackBlitz : options.exportCodeSandbox),
      variantName: untrack(() => code.selectedVariant),
      title,
      description,
      useTypescript: usesTypescript(variant),
    };
    const exportFunction = config.exportFunction || defaultExport;
    openWithForm(create(title, description, exportFunction(variant, config)));
  };

  const result = Object.create(code, {
    component: { get: component, enumerable: true },
    openStackBlitz: {
      value: () =>
        open('StackBlitz', exportVariant, (title, description, { exported, rootFile }) =>
          createStackBlitz({
            title,
            description,
            flattenedFiles: flattenCodeVariant(exported),
            rootFile,
          }),
        ),
      enumerable: true,
    },
    openCodeSandbox: {
      value: () =>
        open('CodeSandbox', exportVariantAsCra, (_title, _description, { exported, rootFile }) =>
          createCodeSandbox({ flattenedFiles: flattenCodeVariant(exported), rootFile }),
        ),
      enumerable: true,
    },
    name: { get: () => contentProps().name, enumerable: true },
    slug: { get: slug, enumerable: true },
  }) as UseDemoResult<T>;
  return () => result;
}
