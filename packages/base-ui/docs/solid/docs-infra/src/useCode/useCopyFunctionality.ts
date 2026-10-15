import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { stringOrHastToString } from '../pipeline/hastUtils';
import { useCopier } from '../useCopier';
import type { UseCopierOpts } from '../useCopier';
import type { Fallbacks, VariantCode, VariantSource } from '../CodeHighlighter/types';
import type { FallbackNode } from '../CodeHighlighter/fallbackFormat';
import { generateVariantMarkdown } from './generateVariantMarkdown';
import type { MarkdownFile } from './generateVariantMarkdown';
import type { TransformedFiles } from './useCodeUtils';
import type { ActionSource } from './useCode';
import type { TransformEngineLoader } from '../CodeProvider/CodeContext';
import { resolveActionVariant } from './resolveActionVariant';

interface UseCopyFunctionalityProps {
  selectedFile: VariantSource | null;
  selectedVariant: VariantCode | null;
  transformedFiles: TransformedFiles | undefined;
  /**
   * Per-file fallbacks for the selected variant (keyed by file name). Used as
   * the DEFLATE dictionary to decode `hastCompressed` sources back to text.
   */
  fallbacks?: Fallbacks;
  /** Fallback for the single selected file (the dictionary for `selectedFile`). */
  selectedFileFallback?: FallbackNode[];
  /** Title used as the heading for the Markdown copy. */
  title?: string;
  copyOpts?: UseCopierOpts;
  actionSource: ActionSource;
  initialVariant: VariantCode | null;
  selectedFileName?: string;
  selectedTransform?: string | null;
  transformEngineLoader?: TransformEngineLoader;
}
export interface UseCopyFunctionalityResult {
  copy: (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => Promise<void>;
  /**
   * Copies all files in the current variant to the clipboard as a Markdown
   * snippet (heading + per-file fenced code blocks).
   */
  copyMarkdown: (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => Promise<void>;
}
export function collectVariantFiles(
  selectedVariant: VariantCode | null,
  transformedFiles: TransformedFiles | undefined,
  fallbacks?: Fallbacks,
): MarkdownFile[] {
  if (!selectedVariant) {
    return [];
  }

  // Resolve per-file DEFLATE dictionaries from both places a fallback can
  // arrive (mirrors `resolvedFallbacks` in `useFileNavigation`): the passed
  // `fallbacks` (hoisted from a `ContentLoading` component) and the variant's
  // own per-file `fallback` fields (kept on `Code` when not stripped — e.g. the
  // standalone `useCode`/`useDemo` path with no `CodeHighlighter` context, so
  // `context?.fallbacks` is undefined). Without this merge, copy-as-markdown
  // throws on a `hastCompressed` source whose dictionary lives on the
  // `VariantCode`. The variant copy wins so the full text — the dictionary
  // `hastCompressed` needs — is used when a `fallbackCollapsed` block hoisted
  // only the visible window.
  const resolvedFallbacks: Fallbacks = {
    ...fallbacks,
  };
  if (selectedVariant.fileName && selectedVariant.fallback) {
    resolvedFallbacks[selectedVariant.fileName] = selectedVariant.fallback;
  }
  for (const [name, fileData] of Object.entries(selectedVariant.extraFiles || {})) {
    if (typeof fileData === 'object' && fileData?.fallback) {
      resolvedFallbacks[name] = fileData.fallback;
    }
  }

  // When a transform has produced files, prefer them so the copied snippet
  // matches what the user is currently viewing. Files the transform actually
  // rewrote are live HAST (already decoded), but files it left untouched are
  // passed through as their ORIGINAL source, which may still be `hastCompressed`
  // and needs its dictionary — resolved here by `originalName`.
  if (transformedFiles && transformedFiles.files.length > 0) {
    return transformedFiles.files.map((file) => ({
      name: file.name,
      source: stringOrHastToString(file.source, resolvedFallbacks[file.originalName]),
    }));
  }
  const files: MarkdownFile[] = [];
  if (selectedVariant.fileName && selectedVariant.source !== undefined) {
    files.push({
      name: selectedVariant.fileName,
      // `resolvedFallbacks` is the active variant's per-file dictionary map, so
      // it decodes a `hastCompressed` source in both the hoisted and the
      // on-`VariantCode` cases.
      source: stringOrHastToString(
        selectedVariant.source,
        resolvedFallbacks[selectedVariant.fileName],
      ),
    });
  }
  if (selectedVariant.extraFiles) {
    for (const [name, fileData] of Object.entries(selectedVariant.extraFiles)) {
      if (typeof fileData === 'string') {
        files.push({
          name,
          source: fileData,
        });
      } else if (fileData && typeof fileData === 'object' && fileData.source !== undefined) {
        files.push({
          name,
          source: stringOrHastToString(fileData.source, resolvedFallbacks[name]),
        });
      }
    }
  }
  return files;
}

/**
 * Hook for managing copy-to-clipboard functionality
 */
export function useCopyFunctionality(
  _params: Accessor<UseCopyFunctionalityProps>,
): Accessor<UseCopyFunctionalityResult> {
  const _params2 = createMemo(() => {
    const {
      selectedFile,
      selectedVariant,
      transformedFiles,
      fallbacks,
      selectedFileFallback,
      title,
      copyOpts,
      actionSource,
      initialVariant,
      selectedFileName,
      selectedTransform,
      transformEngineLoader,
    } = _params();
    return {
      selectedFile,
      selectedVariant,
      transformedFiles,
      fallbacks,
      selectedFileFallback,
      title,
      copyOpts,
      actionSource,
      initialVariant,
      selectedFileName,
      selectedTransform,
      transformEngineLoader,
    };
  });
  const sourceFileToText = (): string | undefined | Promise<string | undefined> => {
    const _initialVariant = _params2().initialVariant;
    const _selectedFileName = _params2().selectedFileName;
    if (_params2().actionSource === 'initial' && _initialVariant && _selectedFileName) {
      return (async () => {
        const resolved = await resolveActionVariant(
          _initialVariant,
          _params2().selectedTransform,
          _params2().transformEngineLoader,
          _params2().fallbacks,
        );
        const resolvedFileName = resolved.filenameMap[_selectedFileName] ?? _selectedFileName;
        if (resolvedFileName === resolved.variant.fileName) {
          return resolved.variant.source
            ? stringOrHastToString(resolved.variant.source, resolved.variant.fallback)
            : undefined;
        }
        const file = resolved.variant.extraFiles?.[resolvedFileName];
        if (typeof file === 'string') {
          return file;
        }
        return file?.source
          ? stringOrHastToString(
              file.source,
              file.fallback ?? _params2().fallbacks?.[_selectedFileName],
            )
          : undefined;
      })();
    }
    const _selectedFile = _params2().selectedFile;
    if (!_selectedFile) {
      return undefined;
    }
    return stringOrHastToString(_selectedFile, _params2().selectedFileFallback);
  };
  const variantToMarkdown = (): string | undefined | Promise<string | undefined> => {
    const _initialVariant2 = _params2().initialVariant;
    if (_params2().actionSource === 'initial' && _initialVariant2) {
      return (async () => {
        const resolved = await resolveActionVariant(
          _initialVariant2,
          _params2().selectedTransform,
          _params2().transformEngineLoader,
          _params2().fallbacks,
        );
        const files = collectVariantFiles(resolved.variant, undefined, _params2().fallbacks);
        return files.length === 0
          ? undefined
          : generateVariantMarkdown({
              title: _params2().title,
              files,
            });
      })();
    }
    const files = collectVariantFiles(
      _params2().selectedVariant,
      _params2().transformedFiles,
      _params2().fallbacks,
    );
    if (files.length === 0) {
      return undefined;
    }
    return generateVariantMarkdown({
      title: _params2().title,
      files,
    });
  };
  const sourceContentRef: {
    current: string | undefined;
  } = {
    current: undefined,
  };
  const markdownContentRef: {
    current: string | undefined;
  } = {
    current: undefined,
  };
  const _useCopier = useCopier(
    () => () => sourceContentRef.current,
    () => _params2().copyOpts,
  );
  const _useCopier3 = createMemo(() => {
    const { copy: copyResolvedSource } = _useCopier();
    return {
      copyResolvedSource,
    };
  });
  const _useCopier2 = useCopier(
    () => () => markdownContentRef.current,
    () => _params2().copyOpts,
  );
  const _useCopier4 = createMemo(() => {
    const { copy: copyResolvedMarkdown } = _useCopier2();
    return {
      copyResolvedMarkdown,
    };
  });
  const copy = async (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    sourceContentRef.current = await sourceFileToText();
    await _useCopier3().copyResolvedSource(event);
  };
  const copyMarkdown = async (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    markdownContentRef.current = await variantToMarkdown();
    await _useCopier4().copyResolvedMarkdown(event);
  };
  return createMemo(() => ({
    copy,
    copyMarkdown,
  }));
}
