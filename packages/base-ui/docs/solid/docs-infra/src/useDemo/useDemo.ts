import { createMemo, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import kebabCase from 'kebab-case';
import { useCode } from '../useCode';
import type { UseCodeOpts } from '../useCode';
import type { ContentProps } from '../CodeHighlighter/types';
import { CodeHighlighterContext } from '../CodeHighlighter/CodeHighlighterContext';
import { createStackBlitz } from './createStackBlitz';
import { createCodeSandbox } from './createCodeSandbox';
import { exportVariant } from './exportVariant';
import type { ExportConfig } from './exportVariant';
import { exportVariantAsCra } from './exportVariantAsCra';
import { flattenCodeVariant } from '../pipeline/loadIsomorphicCodeVariant/flattenCodeVariant';
import { useCodeContext } from '../CodeProvider/CodeContext';
import { resolveActionVariant } from '../useCode/resolveActionVariant';
import type { ResolvedActionVariant } from '../useCode/resolveActionVariant';

/**
 * Demo templates use the exportVariant/exportVariantAsCra with flattenCodeVariant pattern:
 *
 * For StackBlitz:
 * const { exported: exportedVariant, entrypoint } = exportVariant(variantCode);
 * const flattenedFiles = flattenCodeVariant(exportedVariant);
 * createStackBlitzDemo({ title, description, flattenedFiles, useTypescript, initialFile: entrypoint })
 *
 * For CodeSandbox:
 * const { exported: craExport, entrypoint } = exportVariantAsCra(variantCode, { title, description, useTypescript });
 * const flattenedFiles = flattenCodeVariant(craExport);
 * createCodeSandboxDemo({ title, description, flattenedFiles, useTypescript, initialFile: entrypoint })
 * createCodeSandboxDemo({ title, description, flattenedFiles, useTypescript })
 */

export type UseDemoOpts = UseCodeOpts & {
  codeSandboxUrlPrefix?: string;
  stackBlitzPrefix?: string;
  /** Common export configuration applied to both StackBlitz and CodeSandbox */
  export?: ExportConfig;
  /** StackBlitz-specific export configuration (merged with common export config) */
  exportStackBlitz?: ExportConfig;
  /** CodeSandbox-specific export configuration (merged with common export config) */
  exportCodeSandbox?: ExportConfig;
};

/** Reports whether an action variant still contains TypeScript source files. */
function usesTypescript(variant: ResolvedActionVariant['variant']): boolean {
  const fileNames = [variant.fileName, ...Object.keys(variant.extraFiles ?? {})];
  return fileNames.some((fileName) => fileName?.endsWith('.ts') || fileName?.endsWith('.tsx'));
}

/** Runs an action synchronously when transforms are warm, or after their lazy engine loads. */
function runResolvedAction(
  resolved: ResolvedActionVariant | Promise<ResolvedActionVariant>,
  action: (value: ResolvedActionVariant) => void,
): void {
  if (resolved instanceof Promise) {
    void (async () => action(await resolved))();
  } else {
    action(resolved);
  }
}

/**
 * Helper to create HTML form element with hidden inputs
 */
export function addHiddenInput(form: HTMLFormElement, name: string, value: string): void {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/**
 * Generic function to create and submit a form for opening online demo platforms
 * This function creates HTML elements and should be used in browser contexts
 */
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

// TODO: take initialVariant and initialTransforms as parameters
export function useDemo<T extends {} = {}>(
  contentProps: Accessor<ContentProps<T>>,
  opts?: Accessor<UseDemoOpts | undefined>,
) {
  const code = useCode(contentProps, () => opts?.());

  // Extract export configuration options
  const _value = createMemo(() => {
    const {
      export: commonExportConfig = {},
      exportStackBlitz: stackBlitzExportConfig = {},
      exportCodeSandbox: codeSandboxExportConfig = {},
    } = opts?.() || {};
    return {
      commonExportConfig,
      stackBlitzExportConfig,
      codeSandboxExportConfig,
    };
  });
  // Get context to access components if available (using React.useContext to avoid import conflicts)
  const context = useContext(CodeHighlighterContext);
  const _useCodeContext = useCodeContext();
  const _useCodeContext2 = createMemo(() => {
    const { transformEngineLoader } = _useCodeContext();
    return {
      transformEngineLoader,
    };
  });
  const fallbacks = createMemo(() => context()?.fallbacks);
  const slug = createMemo(() => {
    const _contentProps = contentProps();
    return (
      _contentProps.slug || (_contentProps.name ? kebabCase(_contentProps.name, false) : undefined)
    );
  });

  // Get the effective components object - context overrides contentProps
  const effectiveComponents = createMemo(() => {
    return context()?.components || contentProps().components || {};
  });

  // Get the component for the current variant
  const component = createMemo(() => {
    return effectiveComponents()[code().selectedVariant] || null;
  });

  // Surface the selected variant's runtime error, reported by its preview
  // component (e.g. `DemoRunner`) and bridged through `CodeHighlighterContext`.
  const error = createMemo(() => context()?.errors?.[code().selectedVariant] ?? null);

  // Demo-specific ref and focus management. Typed as `HTMLButtonElement` since
  // the typical pattern is an invisible focus-target button rendered inside the
  // demo. `resetFocus` simply calls `.focus()` on it.
  const focusRef: {
    current: HTMLButtonElement | null;
  } = {
    current: null,
  };
  const resetFocus = () => {
    focusRef.current?.focus();
  };

  // Get the effective code - context overrides contentProps if available
  const effectiveCode = createMemo(() => {
    return context()?.code || contentProps().code || {};
  });
  const initialCode = createMemo(() => {
    const _context = context();
    return contentProps().code ?? _context?.initialCode ?? _context?.code;
  });
  const actionCode = createMemo(() =>
    opts?.()?.actionSource === 'initial' ? initialCode() || {} : effectiveCode(),
  );
  const resolveSelectedAction = () => {
    const variantCode = actionCode()[code().selectedVariant];
    if (!variantCode || typeof variantCode === 'string') {
      return null;
    }
    return resolveActionVariant(
      variantCode,
      code().selectedTransform,
      _useCodeContext2().transformEngineLoader,
      fallbacks(),
    );
  };

  // Create StackBlitz demo callback
  const openStackBlitz = () => {
    const resolvedAction = resolveSelectedAction();
    if (!resolvedAction) {
      console.warn('No valid variant code available for StackBlitz demo');
      return;
    }
    const title = contentProps().name || 'Demo';
    const description = `${title} demo`;
    runResolvedAction(resolvedAction, ({ variant }) => {
      const mergedConfig: ExportConfig = {
        ..._value().commonExportConfig,
        ..._value().stackBlitzExportConfig,
        variantName: code().selectedVariant,
        title,
        description,
        useTypescript: usesTypescript(variant),
      };
      const exportFunction = mergedConfig.exportFunction || exportVariant;
      const { exported, rootFile } = exportFunction(variant, mergedConfig);
      const flattenedFiles = flattenCodeVariant(exported);
      const stackBlitzDemo = createStackBlitz({
        title,
        description,
        flattenedFiles,
        rootFile,
      });
      openWithForm(stackBlitzDemo);
    });
  };

  // Create CodeSandbox demo callback
  const openCodeSandbox = () => {
    const resolvedAction = resolveSelectedAction();
    if (!resolvedAction) {
      console.warn('No valid variant code available for CodeSandbox demo');
      return;
    }
    const title = contentProps().name || 'Demo';
    const description = `${title} demo`;
    runResolvedAction(resolvedAction, ({ variant }) => {
      const mergedConfig: ExportConfig = {
        ..._value().commonExportConfig,
        ..._value().codeSandboxExportConfig,
        variantName: code().selectedVariant,
        title,
        description,
        useTypescript: usesTypescript(variant),
      };
      const exportFunction = mergedConfig.exportFunction || exportVariantAsCra;
      const { exported: craExport, rootFile } = exportFunction(variant, mergedConfig);
      const flattenedFiles = flattenCodeVariant(craExport);
      const codeSandboxDemo = createCodeSandbox({
        flattenedFiles,
        rootFile,
      });
      openWithForm(codeSandboxDemo);
    });
  };
  return createMemo(() => ({
    ...code(),
    // Demo-specific additions
    component: component(),
    error: error(),
    focusRef,
    resetFocus,
    openStackBlitz,
    openCodeSandbox,
    name: contentProps().name,
    slug: slug(),
  }));
}
