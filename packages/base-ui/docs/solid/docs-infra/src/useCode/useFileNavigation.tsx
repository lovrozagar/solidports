import { element, initialState } from 'docs/src/adapters/react';
import { createEffect, createMemo, createSignal, For, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { decodeHastSource } from '../pipeline/loadIsomorphicCodeVariant/decodeHastSource';
import type {
  Fallbacks,
  VariantCode,
  VariantSource,
  Code,
  SourceEnhancers,
  SourceComments,
  EditableSourceProjection,
} from '../CodeHighlighter/types';
import type { FallbackNode } from '../CodeHighlighter/fallbackFormat';
import { useUrlHashState } from '../useUrlHashState';
import { countLines } from '../pipeline/parseSource/addLineGutters';
import { getLanguageFromExtension } from '../pipeline/loaderUtils/getLanguageFromExtension';
import type { TransformedFiles } from './useCodeUtils';
import { getSourceLineCounts, getVariantFileLineCounts } from './sourceLineCounts';
import type { SetSource } from './useSourceEditing';
import { Pre } from './Pre';
import { useSourceEnhancing } from './useSourceEnhancing';
import { toKebabCase } from '../pipeline/loaderUtils/toKebabCase';
import { generateFileSlug } from '../pipeline/loaderUtils/generateFileSlug';

/**
 * Gets the language from a filename by extracting its extension.
 * @param fileName - The filename (e.g., 'index.tsx', 'styles.css')
 * @returns The language name or undefined
 */
function getLanguageFromFileName(fileName: string | undefined): string | undefined {
  if (!fileName) {
    return undefined;
  }
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return undefined;
  }
  const extension = fileName.substring(lastDotIndex);
  return getLanguageFromExtension(extension);
}

/**
 * Checks if the URL hash is relevant to a specific demo
 * Hash format is: {mainSlug}:{variantName}:{fileName} or {mainSlug}:{fileName}
 * @param urlHash - The URL hash (without '#')
 * @param mainSlug - The main slug for the demo
 * @returns true if the hash starts with the demo's slug
 */
export function isHashRelevantToDemo(urlHash: string | null, mainSlug?: string): boolean {
  if (!urlHash || !mainSlug) {
    return false;
  }
  const kebabSlug = toKebabCase(mainSlug);
  return urlHash.startsWith(`${kebabSlug}:`);
}
function getPreRenderKey(
  slug: string | undefined,
  enhancementPhase: 'plain' | 'base' | 'enhanced' = 'plain',
): string {
  // Intentionally keyed only on the canonical file slug (and enhancement
  // phase). Transforms (e.g. JS↔TS) swap the *content* of the same file —
  // including `selectedTransform` here would unmount/remount `<Pre>` on
  // every transform toggle, dropping scroll position, focus, and any
  // IO/RO-driven UI state. Slugs are already built from the original
  // (pre-transform) file name, so the key stays stable across transforms.
  return `${slug ?? 'code'}:${enhancementPhase}`;
}
interface UseFileNavigationProps {
  selectedVariant: VariantCode | null;
  transformedFiles: TransformedFiles | undefined;
  selectedTransform?: string | null;
  mainSlug?: string;
  selectedVariantKey?: string;
  variantKeys?: string[];
  shouldHighlight: boolean;
  preClassName?: string;
  setSource?: SetSource;
  /**
   * Forwarded to `<Pre>`: when the textarea editor loads for an
   * editable block. `'eager'` (default) loads on mount; `'interaction'` defers
   * until the user hovers/focuses/clicks. Sourced from the `editActivation`
   * prop on `CodeHighlighter` (via `CodeHighlighterContext`).
   */
  editActivation?: 'eager' | 'interaction';
  /** Forwarded to `<Pre>`: fired once when the block engages for editing. */
  onActivate?: () => void;
  /** Forwarded to `<Pre>`: expands focused source from textarea boundary navigation. */
  onBoundary?: () => void;
  /** Forwarded to `<Pre>`: whether edit mode is on. When `false` the block stays read-only. */
  editable?: boolean;
  effectiveCode?: Code;
  selectVariant?: (value: string | ((prev: string) => string)) => void;
  fileHashMode?: 'remove-hash' | 'remove-filename';
  saveHashVariantToLocalStorage?: 'on-load' | 'on-interaction' | 'never';
  saveVariantToLocalStorage?: (variant: string) => void;
  hashVariant?: string | null;
  /**
   * Array of enhancer functions to apply to parsed HAST sources.
   * Enhancers receive the HAST root, comments extracted from source, and filename.
   */
  sourceEnhancers?: SourceEnhancers;
  /**
   * Compact fallback data for the active variant, keyed by filename.
   */
  fallbacks?: Fallbacks;
  /**
   * Whether the surrounding code block is currently expanded. Forwarded to
   * `<Pre>` so it can disable collapsed-state behaviors (e.g. `minColumn`).
   */
  expanded?: boolean;
  /**
   * Render-time "collapse to empty". Forwarded to `<Pre>`: collapses the block to an
   * empty window (whole block hidden until expanded) by demoting collapsed-
   * visible frame types at render. Orthogonal to `expanded`.
   */
  collapseToEmpty?: boolean;
  /**
   * Currently-selected file name. The hook is always controlled —
   * callers (typically `useCode`) own the state so it can be read
   * upstream of `useFileNavigation` to drive transform-management
   * decisions.
   */
  selectedFileName: string | undefined;
  /**
   * Setter for `selectedFileName`. Called by the hook in response to
   * hash changes, variant switches, and `selectFileName` invocations.
   */
  setSelectedFileName: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  /**
   * Whether the reader has edited the source. Once they have, a transformed
   * file's precomputed source projection is stale and the variant's live one
   * wins. See `selectedFileSourceProjection`.
   */
  hasControlledEdits?: boolean;
}
export interface UseFileNavigationResult {
  selectedFileName: string | undefined;
  selectedFileOriginalName: string | undefined;
  selectedFileUrl: string | undefined;
  /**
   * Slug for the currently selected file, derived from the canonical
   * (original) file name. Transforms are a view preference applied after
   * navigation, so transformed files do not get their own slug — the slug
   * for `Counter.tsx` remains the same whether the `js` transform is
   * active or not.
   */
  selectedFileSlug: string | undefined;
  selectedFile: VariantSource | null;
  /** DEFLATE dictionary for the selected file's `hastCompressed` source. */
  selectedFileFallback: FallbackNode[] | undefined;
  selectedFileComponent: JSX.Element;
  selectedFileLines: number;
  selectedFileFocusedLines: number;
  selectedFileCollapsible: boolean;
  selectedFileHasFocusProjection: boolean;
  selectedFileSourceProjection: EditableSourceProjection | undefined;
  files: Array<{
    name: string;
    slug?: string;
    component: JSX.Element;
  }>;
  selectFileName: (fileName: string) => void;
  allFilesSlugs: Array<{
    fileName: string;
    slug: string;
    variantName: string;
  }>;
}

/**
 * Hook for managing file selection and navigation within a code variant
 */
export function useFileNavigation(
  _params: Accessor<UseFileNavigationProps>,
): Accessor<UseFileNavigationResult> {
  const _params2 = createMemo(() => {
    const {
      selectedVariant,
      transformedFiles,
      // Note: `selectedTransform` is accepted as a prop (callers spread the
      // result of `useTransformManagement`) but intentionally not destructured
      // here — the rendered <Pre> children come from `transformedFiles` /
      // `selectedFile`, which already reflect the active transform. Keying or
      // memo-deping on the transform name would only cause unnecessary
      // remounts on transform toggles.
      mainSlug = '',
      selectedVariantKey = '',
      variantKeys = [],
      shouldHighlight,
      preClassName,
      setSource,
      editActivation,
      onActivate,
      onBoundary,
      editable,
      effectiveCode,
      selectVariant,
      fileHashMode = 'remove-hash',
      saveHashVariantToLocalStorage = 'on-interaction',
      saveVariantToLocalStorage,
      hashVariant,
      sourceEnhancers,
      fallbacks,
      expanded,
      collapseToEmpty,
      selectedFileName: selectedFileNameInternal,
      setSelectedFileName: setSelectedFileNameInternal,
      hasControlledEdits = false,
    } = _params();
    return {
      selectedVariant,
      transformedFiles,
      shouldHighlight,
      preClassName,
      setSource,
      editActivation,
      onActivate,
      onBoundary,
      editable,
      effectiveCode,
      selectVariant,
      saveVariantToLocalStorage,
      hashVariant,
      sourceEnhancers,
      fallbacks,
      expanded,
      collapseToEmpty,
      selectedFileNameInternal,
      setSelectedFileNameInternal,
      mainSlug,
      selectedVariantKey,
      variantKeys,
      fileHashMode,
      saveHashVariantToLocalStorage,
      hasControlledEdits,
    };
  });
  const _useUrlHashState = useUrlHashState();
  const _useUrlHashState2 = createMemo(() => {
    const [hash, setHash] = _useUrlHashState();
    return {
      hash,
      setHash,
    };
  });
  // Track if we're waiting for a variant switch to complete, and which file to select after
  const pendingFileSelection: {
    current: string | null;
  } = {
    current: null,
  };
  const justCompletedPendingSelection = {
    current: false,
  };

  // Track the previous variant key to detect user-initiated changes
  const prevVariantKeyRef = {
    current: untrack(_params2).selectedVariantKey,
  };
  const [prevVariantKeyState, setPrevVariantKeyState] = createSignal(() =>
    untrack(() => initialState(_params2().selectedVariantKey)),
  );
  const isInitialMount = {
    current: true,
  };

  // Detect if the current variant change was driven by a hash change
  // A variant change is hash-driven if the hash has a variant that matches where we're going
  // AND we weren't already on that variant (i.e., the hash is what triggered the change)
  const isHashDrivenVariantChange = createMemo(() => {
    const _selectedVariantKey = _params2().selectedVariantKey;
    return (
      _params2().hashVariant === _selectedVariantKey &&
      prevVariantKeyState() !== _selectedVariantKey
    );
  });

  // Update prevVariantKeyState when variant changes
  createEffect(
    () => [_params2().selectedVariantKey, prevVariantKeyState()],
    () => {
      const _selectedVariantKey2 = _params2().selectedVariantKey;
      if (_selectedVariantKey2 !== prevVariantKeyState()) {
        setPrevVariantKeyState(_selectedVariantKey2);
      }
    },
  );
  // Helper function to check URL hash and switch to matching file
  const checkUrlHashAndSelectFile = () => {
    const _hash = _useUrlHashState2().hash;
    if (!_hash) {
      return;
    }

    // Try to find matching file - check current variant first
    let matchingFileName: string | undefined;
    let matchingVariantKey: string | undefined;

    // Step 1: Check current variant (if we have one)
    const _selectedVariant = _params2().selectedVariant;
    const _mainSlug = _params2().mainSlug;
    const _selectedVariantKey3 = _params2().selectedVariantKey;
    const _transformedFiles = _params2().transformedFiles;
    if (_selectedVariant) {
      // Check main file
      if (_selectedVariant.fileName) {
        const mainFileSlug = generateFileSlug(
          _mainSlug,
          _selectedVariant.fileName,
          _selectedVariantKey3,
        );
        if (_hash === mainFileSlug) {
          matchingFileName = _selectedVariant.fileName;
          matchingVariantKey = _selectedVariantKey3;
        }
      }

      // Check extra files
      if (!matchingFileName && _selectedVariant.extraFiles) {
        for (const fileName of Object.keys(_selectedVariant.extraFiles)) {
          const fileSlug = generateFileSlug(_mainSlug, fileName, _selectedVariantKey3);
          if (_hash === fileSlug) {
            matchingFileName = fileName;
            matchingVariantKey = _selectedVariantKey3;
            break;
          }
        }
      }

      // Check transformed files
      if (!matchingFileName && _transformedFiles) {
        for (const file of _transformedFiles.files) {
          const fileSlug = generateFileSlug(_mainSlug, file.originalName, _selectedVariantKey3);
          if (_hash === fileSlug) {
            matchingFileName = file.originalName;
            matchingVariantKey = _selectedVariantKey3;
            break;
          }
        }
      }
    }

    // Step 2: If no match and we can switch variants, search other variants
    const _effectiveCode = _params2().effectiveCode;
    const _mainSlug2 = _params2().mainSlug;
    if (!matchingFileName && _effectiveCode && _params2().selectVariant) {
      for (const [variantKey, variant] of Object.entries(_effectiveCode)) {
        // Skip current variant (already checked) and invalid variants
        if (
          variantKey === _params2().selectedVariantKey ||
          !variant ||
          typeof variant === 'string'
        ) {
          continue;
        }

        // Check main file
        if (variant.fileName) {
          const mainFileSlug = generateFileSlug(_mainSlug2, variant.fileName, variantKey);
          if (_hash === mainFileSlug) {
            matchingFileName = variant.fileName;
            matchingVariantKey = variantKey;
            break;
          }
        }

        // Check extra files
        if (!matchingFileName && variant.extraFiles) {
          for (const fileName of Object.keys(variant.extraFiles)) {
            const fileSlug = generateFileSlug(_mainSlug2, fileName, variantKey);
            if (_hash === fileSlug) {
              matchingFileName = fileName;
              matchingVariantKey = variantKey;
              break;
            }
          }
        }
        if (matchingFileName) {
          break;
        }
      }
    }
    const _selectVariant = _params2().selectVariant;
    if (matchingFileName && matchingVariantKey) {
      // If the matching file is in a different variant, switch to that variant first
      if (matchingVariantKey !== _params2().selectedVariantKey && _selectVariant) {
        // Remember which file to select after variant switch
        pendingFileSelection.current = matchingFileName;
        _selectVariant(matchingVariantKey);
        // Don't set the file here - it will be set after variant changes
        return;
      }

      // Set the file if we're in the correct variant
      pendingFileSelection.current = null;
      _params2().setSelectedFileNameInternal(matchingFileName);
    }
  };

  // Run hash check when URL hash changes to select the matching file
  createEffect(
    () => [checkUrlHashAndSelectFile],
    () => {
      checkUrlHashAndSelectFile();
    },
  );
  createEffect(
    () => [
      _params2().selectedVariantKey,
      _params2().selectedVariant,
      _params2().setSelectedFileNameInternal,
    ],
    () => {
      if (pendingFileSelection.current && _params2().selectedVariant) {
        const fileToSelect = pendingFileSelection.current;
        pendingFileSelection.current = null;
        justCompletedPendingSelection.current = true;
        _params2().setSelectedFileNameInternal(fileToSelect);
      } else {
        justCompletedPendingSelection.current = false;
      }
    },
  );
  createEffect(
    () => [
      _params2().selectedVariant,
      _params2().selectedFileNameInternal,
      _params2().setSelectedFileNameInternal,
    ],
    () => {
      // Skip reset if we have a pending file selection from hash navigation
      // OR if we just completed a pending file selection
      if (pendingFileSelection.current || justCompletedPendingSelection.current) {
        return;
      }
      const _selectedVariant2 = _params2().selectedVariant;
      const _selectedFileNameInternal = _params2().selectedFileNameInternal;
      if (_selectedVariant2 && _selectedFileNameInternal !== _selectedVariant2.fileName) {
        // Only reset if current selectedFileName doesn't exist in the new variant
        const hasFile =
          _selectedVariant2.fileName === _selectedFileNameInternal ||
          (_selectedFileNameInternal &&
            _selectedVariant2.extraFiles &&
            _selectedVariant2.extraFiles[_selectedFileNameInternal]);
        if (!hasFile) {
          _params2().setSelectedFileNameInternal(_selectedVariant2.fileName);
        }
      }
    },
  );
  createEffect(
    () => [
      _params2().selectedVariantKey,
      _useUrlHashState2().hash,
      _params2().mainSlug,
      _params2().fileHashMode,
      _useUrlHashState2().setHash,
      isHashDrivenVariantChange(),
    ],
    () => {
      // Skip on initial mount - let hash-driven navigation handle it
      if (isInitialMount.current) {
        isInitialMount.current = false;
        prevVariantKeyRef.current = _params2().selectedVariantKey;
        return;
      }

      // Only update hash if there's already a relevant hash present
      const _mainSlug3 = _params2().mainSlug;
      if (
        typeof window === 'undefined' ||
        !isHashRelevantToDemo(_useUrlHashState2().hash, _mainSlug3)
      ) {
        prevVariantKeyRef.current = _params2().selectedVariantKey;
        return;
      }

      // Skip if variant hasn't actually changed
      const _selectedVariantKey4 = _params2().selectedVariantKey;
      if (prevVariantKeyRef.current === _selectedVariantKey4) {
        return;
      }

      // Skip if this is a hash-driven variant change (hash is driving the variant selection)
      if (
        pendingFileSelection.current ||
        justCompletedPendingSelection.current ||
        isHashDrivenVariantChange()
      ) {
        prevVariantKeyRef.current = _selectedVariantKey4;
        return;
      }

      // User switched variants, update hash based on fileHashMode
      // Note: localStorage is already saved by setSelectedVariantKeyAsUser
      const _setHash = _useUrlHashState2().setHash;
      if (_params2().fileHashMode === 'remove-filename') {
        // Keep variant in hash: mainSlug or mainSlug:variant (for non-Default variants)
        const kebabMainSlug = toKebabCase(_mainSlug3);
        if (_selectedVariantKey4 === 'Default') {
          _setHash(kebabMainSlug);
        } else {
          const kebabVariantName = toKebabCase(_selectedVariantKey4);
          _setHash(`${kebabMainSlug}:${kebabVariantName}`);
        }
      } else {
        // Remove entire hash
        _setHash(null);
      }
      prevVariantKeyRef.current = _selectedVariantKey4;
    },
  );
  // Compute the displayed filename (transformed if applicable)
  const selectedFileName = createMemo(() => {
    const _selectedVariant3 = _params2().selectedVariant;
    if (!_selectedVariant3) {
      return undefined;
    }

    // If selectedFileNameInternal is undefined, we're selecting the main file
    const effectiveFileName = _params2().selectedFileNameInternal || _selectedVariant3.fileName;
    if (!effectiveFileName) {
      return undefined;
    }

    // If we have transformed files, return the transformed name
    const _transformedFiles2 = _params2().transformedFiles;
    if (_transformedFiles2) {
      const file = _transformedFiles2.files.find((f) => f.originalName === effectiveFileName);
      return file ? file.name : effectiveFileName;
    }

    // Otherwise, return the original filename
    return effectiveFileName;
  });

  // Derive the URL of the currently selected file by combining the variant URL
  // with the selected file's name and (optional) `relativeUrl`. When the
  // selected file is the variant entry, the variant URL is used directly.
  //
  // For an extra file:
  //   - string entry: it is itself a fully-qualified URL.
  //   - object entry with `relativeUrl`: resolve `relativeUrl` against the
  //     variant URL.
  //   - object entry without `relativeUrl`: by the `extraFiles` contract the
  //     key itself resolves to the file URL against the variant URL, so we
  //     resolve the key. Authors who provide a synthetic key for an inline
  //     entry should also avoid setting `variant.url` (or should not consume
  //     `selectedFileUrl`).
  const selectedFileUrl = createMemo<string | undefined>(() => {
    const _selectedVariant4 = _params2().selectedVariant;
    if (!_selectedVariant4?.url) {
      return undefined;
    }
    const effectiveFileName = _params2().selectedFileNameInternal || _selectedVariant4.fileName;
    if (!effectiveFileName || effectiveFileName === _selectedVariant4.fileName) {
      return _selectedVariant4.url;
    }
    const extraFile = _selectedVariant4.extraFiles?.[effectiveFileName];
    if (typeof extraFile === 'string') {
      // String form is already a fully-qualified URL.
      return extraFile;
    }
    const relativeUrl =
      extraFile && typeof extraFile === 'object' ? extraFile.relativeUrl : undefined;
    try {
      return new URL(relativeUrl ?? effectiveFileName, _selectedVariant4.url).href;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `useFileNavigation: failed to derive selectedFileUrl for "${effectiveFileName}" against "${_selectedVariant4.url}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return undefined;
    }
  });

  // Slug for the currently selected file. Always derived from the canonical
  // (original) file name so that transforms remain a view preference and do
  // not produce a separate URL — clicking a permalink lands on the same
  // file regardless of which transform the visitor has selected.
  const selectedFileSlug = createMemo<string | undefined>(() => {
    const _selectedVariant5 = _params2().selectedVariant;
    if (!_selectedVariant5) {
      return undefined;
    }
    const effectiveFileName = _params2().selectedFileNameInternal || _selectedVariant5.fileName;
    if (!effectiveFileName) {
      return undefined;
    }
    return generateFileSlug(_params2().mainSlug, effectiveFileName, _params2().selectedVariantKey);
  });
  const selectedFile = createMemo(() => {
    const _selectedVariant6 = _params2().selectedVariant;
    if (!_selectedVariant6) {
      return null;
    }

    // If we have transformed files, use them
    const _transformedFiles3 = _params2().transformedFiles;
    if (_transformedFiles3) {
      const effectiveFileName = _params2().selectedFileNameInternal || _selectedVariant6.fileName;
      const file = _transformedFiles3.files.find((f) => f.originalName === effectiveFileName);
      return file ? file.source : null;
    }

    // Otherwise, use the original untransformed files
    const _selectedFileNameInternal2 = _params2().selectedFileNameInternal;
    if (_selectedFileNameInternal2 === _selectedVariant6.fileName || !_selectedFileNameInternal2) {
      return _selectedVariant6.source ?? null;
    }

    // Look in extraFiles
    if (
      _selectedFileNameInternal2 &&
      _selectedVariant6.extraFiles &&
      _selectedVariant6.extraFiles[_selectedFileNameInternal2]
    ) {
      const extraFile = _selectedVariant6.extraFiles[_selectedFileNameInternal2];
      if (typeof extraFile === 'string') {
        return extraFile;
      }
      if (extraFile && typeof extraFile === 'object' && 'source' in extraFile) {
        return extraFile.source ?? null;
      }
    }
    return null;
  });

  // Get comments for the selected file. When a transformed view is
  // active, prefer the transformed file's own `comments` map — it has
  // already been remapped onto the post-transform line numbers by
  // `applyCodeTransformWithComments`, so client-side enhancers see
  // markers that line up with the source they're being handed. Falling
  // back to `selectedVariant.comments` would feed the enhancer the
  // original (pre-transform) line numbers, silently mis-aligning every
  // `@focus` / `@padding-*` marker on transformed renders.
  const selectedFileComments = createMemo((): SourceComments | undefined => {
    const _selectedVariant7 = _params2().selectedVariant;
    if (!_selectedVariant7) {
      return undefined;
    }
    const effectiveFileName = _params2().selectedFileNameInternal || _selectedVariant7.fileName;
    if (!effectiveFileName) {
      return undefined;
    }
    const _transformedFiles4 = _params2().transformedFiles;
    if (_transformedFiles4) {
      const transformedFile = _transformedFiles4.files.find(
        (file) => file.originalName === effectiveFileName,
      );
      if (transformedFile) {
        return transformedFile.comments;
      }
    }

    // Check if it's the main file
    if (effectiveFileName === _selectedVariant7.fileName) {
      return _selectedVariant7.comments;
    }

    // Check extra files
    if (_selectedVariant7.extraFiles?.[effectiveFileName]) {
      const extraFile = _selectedVariant7.extraFiles[effectiveFileName];
      if (typeof extraFile === 'object' && 'comments' in extraFile) {
        return extraFile.comments;
      }
    }
    return undefined;
  });

  // Resolve per-file DEFLATE dictionaries from both places a fallback can
  // arrive: `fallbacks` (hoisted from a `ContentLoading` component, for files
  // whose fallback was stripped off `Code`) and the variant's own per-file
  // `fallback` fields (kept on `Code` for files that weren't stripped — e.g.
  // extra files when `fallbackUsesExtraFiles` is off, the no-`ContentLoading`
  // path, or fallbacks scattered back from the residual blob). For most files
  // only one is populated. When both are — a `fallbackCollapsed` block hoists
  // the *visible* window but scatters the *full* fallback onto `Code` — the
  // `Code` copy must win, because the full text is the dictionary
  // `hastCompressed` needs. So the variant copy takes precedence.
  const resolvedFallbacks = createMemo(() => {
    const fromVariant: Fallbacks = {};
    const _selectedVariant8 = _params2().selectedVariant;
    if (_selectedVariant8) {
      if (_selectedVariant8.fileName && _selectedVariant8.fallback) {
        fromVariant[_selectedVariant8.fileName] = _selectedVariant8.fallback;
      }
      for (const [name, fileData] of Object.entries(_selectedVariant8.extraFiles || {})) {
        if (typeof fileData === 'object' && fileData?.fallback) {
          fromVariant[name] = fileData.fallback;
        }
      }
    }
    return {
      ..._params2().fallbacks,
      ...fromVariant,
    };
  });

  // The DEFLATE dictionary for the currently selected file's `hastCompressed`
  // source. Extra files key by name; the main file prefers its fileName-keyed
  // entry, falling back to the variant's own `fallback` field (the only way to
  // resolve a main file with no fileName, e.g. a bare markdown fence).
  const selectedFileFallback = createMemo(() => {
    const _selectedFileNameInternal3 = _params2().selectedFileNameInternal;
    const _selectedVariant9 = _params2().selectedVariant;
    if (_selectedFileNameInternal3 && _selectedFileNameInternal3 !== _selectedVariant9?.fileName) {
      return resolvedFallbacks()[_selectedFileNameInternal3];
    }
    return (
      (_selectedVariant9?.fileName ? resolvedFallbacks()[_selectedVariant9.fileName] : undefined) ??
      _selectedVariant9?.fallback
    );
  });
  const selectedFileOriginalName = createMemo(
    () => _params2().selectedFileNameInternal || _params2().selectedVariant?.fileName,
  );
  const selectedTransformedFile = createMemo(() =>
    _params2().transformedFiles?.files.find(
      (file) => file.originalName === selectedFileOriginalName(),
    ),
  );
  const selectedFileLineCounts = createMemo(() => {
    const _selectedVariant0 = _params2().selectedVariant;
    const _selectedFileOriginalName = selectedFileOriginalName();
    if (!_selectedVariant0 || !_selectedFileOriginalName) {
      return null;
    }
    const _selectedTransformedFile = selectedTransformedFile();
    if (_selectedTransformedFile) {
      const originalFile =
        _selectedFileOriginalName === _selectedVariant0.fileName
          ? _selectedVariant0
          : _selectedVariant0.extraFiles?.[_selectedFileOriginalName];
      const originalSource = typeof originalFile === 'string' ? originalFile : originalFile?.source;
      if (_selectedTransformedFile.source !== originalSource) {
        return getSourceLineCounts(_selectedTransformedFile.source, selectedFileFallback());
      }
    }
    return getVariantFileLineCounts(_selectedVariant0, _selectedFileOriginalName);
  });
  const selectedFileSourceProjection = createMemo(() => {
    // The variant carries the LIVE projection: `setSource` recomputes it on
    // every keystroke, so its offsets track the edited source.
    let liveProjection: EditableSourceProjection | undefined;
    const _selectedVariant1 = _params2().selectedVariant;
    const _selectedFileOriginalName2 = selectedFileOriginalName();
    if (_selectedVariant1 && _selectedFileOriginalName2) {
      if (_selectedFileOriginalName2 === _selectedVariant1.fileName) {
        liveProjection = _selectedVariant1.sourceProjection;
      } else {
        const file = _selectedVariant1.extraFiles?.[_selectedFileOriginalName2];
        liveProjection =
          typeof file === 'object' && file !== null ? file.sourceProjection : undefined;
      }
    }
    const _selectedTransformedFile2 = selectedTransformedFile();
    if (_selectedTransformedFile2) {
      // A transformed file's projection is precomputed against the untouched
      // transform output, so it describes the pre-edit text and its offsets go
      // stale the moment the reader types. Prefer it only while the source is
      // pristine — otherwise the projection fails validation, the editor falls
      // back to the whole file, and a collapsed preview expands mid-edit.
      return _params2().hasControlledEdits
        ? (liveProjection ?? _selectedTransformedFile2.sourceProjection)
        : (_selectedTransformedFile2.sourceProjection ?? liveProjection);
    }
    return liveProjection;
  });
  const selectedFileHasFocusProjection = createMemo(
    () => selectedFileSourceProjection() !== undefined,
  );

  // Apply source enhancers to the selected file
  const _useSourceEnhancing = useSourceEnhancing(() => ({
    source: selectedFile(),
    fileName: selectedFileName(),
    comments: selectedFileComments(),
    sourceEnhancers: _params2().sourceEnhancers,
    fallback: selectedFileFallback(),
  }));
  const _useSourceEnhancing2 = createMemo(() => {
    const { enhancedSource, isEnhancing } = _useSourceEnhancing();
    return {
      enhancedSource,
      isEnhancing,
    };
  });
  const selectedFileComponent = createMemo(() => {
    const _selectedVariant10 = _params2().selectedVariant;
    if (!_selectedVariant10) {
      return null;
    }

    // Determine the source to render:
    // - If enhancers are present, use enhanced source (falls back to selectedFile)
    // - Otherwise use selectedFile directly (which may be from transformed files)
    const _sourceEnhancers = _params2().sourceEnhancers;
    const _selectedFile = selectedFile();
    const sourceToRender =
      _sourceEnhancers && _sourceEnhancers.length > 0
        ? (_useSourceEnhancing2().enhancedSource ?? _selectedFile)
        : _selectedFile;
    const _selectedFileNameInternal4 = _params2().selectedFileNameInternal;
    const _selectedFileName = selectedFileName();
    const _sourceEnhancers2 = _params2().sourceEnhancers;
    if (sourceToRender != null) {
      // Determine language: use variant's language for main file, or derive from filename for extra files
      const isMainFile =
        !_selectedFileNameInternal4 || _selectedFileNameInternal4 === _selectedVariant10.fileName;
      const language =
        getLanguageFromFileName(_selectedFileName) ??
        (isMainFile
          ? _selectedVariant10.language
          : getLanguageFromFileName(_selectedFileNameInternal4));
      const fileName = _selectedFileNameInternal4 || _selectedVariant10.fileName;
      const fileSlug = generateFileSlug(
        _params2().mainSlug,
        _selectedFileNameInternal4 ?? _selectedVariant10.fileName ?? 'code',
        _params2().selectedVariantKey,
      );
      let enhancementPhase: 'plain' | 'base' | 'enhanced' = 'plain';
      if (_sourceEnhancers2 && _sourceEnhancers2.length > 0) {
        enhancementPhase = _useSourceEnhancing2().isEnhancing ? 'base' : 'enhanced';
      }
      return element(() => (
        <For each={[getPreRenderKey(fileSlug, enhancementPhase)]}>
          {() => (
            <Pre
              class={_params2().preClassName}
              fileName={fileName}
              displayFileName={_selectedFileName}
              language={language}
              setSource={_params2().setSource}
              editActivation={_params2().editActivation}
              onActivate={_params2().onActivate}
              onBoundary={_params2().onBoundary}
              editable={_params2().editable}
              shouldHighlight={_params2().shouldHighlight}
              fallback={selectedFileFallback()}
              fallbackLineCounts={selectedFileLineCounts()}
              expanded={_params2().expanded}
              collapseToEmpty={_params2().collapseToEmpty}
              sourceProjection={selectedFileSourceProjection()}
            >
              {sourceToRender}
            </Pre>
          )}
        </For>
      ));
    }
    return null;
  });
  const selectedFileLines = createMemo(() => {
    const _selectedFile2 = selectedFile();
    if (_selectedFile2 == null) {
      return 0;
    }

    // If it's a string, split by newlines and count.
    if (typeof _selectedFile2 === 'string') {
      return _selectedFile2.split('\n').length;
    }

    // A compressed payload (`hastCompressed` / `hastJson`) is never a transformed
    // tree — transforms produce live HAST — so the stored variant count is
    // authoritative for it. Use it instead of decompressing the source just to read
    // the count, even when OTHER files in the variant are transformed. Only a live
    // (transformed or in-hand) tree, or a legacy payload with no stored count, falls
    // through to read the hast below.
    const isCompressedSource = 'hastJson' in _selectedFile2 || 'hastCompressed' in _selectedFile2;
    const _selectedFileLineCounts = selectedFileLineCounts();
    if (isCompressedSource && _selectedFileLineCounts && _selectedFileLineCounts.totalLines > 0) {
      return _selectedFileLineCounts.totalLines;
    }

    // A live HAST tree (e.g. a transformed source) carries its own up-to-date counts
    // in `root.data`; `decodeHastSource` returns such a tree unchanged (no
    // decompression). A compressed source with no stored count (a legacy precompute)
    // is the only case that actually decompresses here — and it's the same tree
    // `<Pre>` decodes to render, so the shared decode cache amortizes it. The
    // selected file's `fallback` is forwarded as the matching DEFLATE dictionary.
    const hastSelectedFile = decodeHastSource(_selectedFile2, selectedFileFallback());
    if (hastSelectedFile) {
      if (hastSelectedFile.data && 'totalLines' in hastSelectedFile.data) {
        const totalLines = hastSelectedFile.data.totalLines;
        // Check if totalLines is a valid number (not null, undefined, or NaN)
        if (totalLines != null && !Number.isNaN(Number(totalLines))) {
          const numLines = Number(totalLines);
          if (numLines >= 0) {
            return numLines;
          }
        }
        // Fall through to children count if totalLines is invalid
      }
      if ('children' in hastSelectedFile) {
        // Use countLines for more accurate line counting of HAST trees
        return countLines(hastSelectedFile);
      }
    }
    return 0;
  });

  // Convert files for the return interface
  const files = createMemo(() => {
    const _selectedVariant11 = _params2().selectedVariant;
    if (!_selectedVariant11) {
      return [];
    }

    // If we have transformed files, use them
    const _transformedFiles5 = _params2().transformedFiles;
    if (_transformedFiles5) {
      return _transformedFiles5.files.map((f) => ({
        name: f.name,
        slug: generateFileSlug(_params2().mainSlug, f.originalName, _params2().selectedVariantKey),
        component: element(() => (
          <For
            each={[
              getPreRenderKey(
                generateFileSlug(
                  _params2().mainSlug,
                  f.originalName,
                  _params2().selectedVariantKey,
                ),
              ),
            ]}
          >
            {() => (
              <Pre
                class={_params2().preClassName}
                fileName={f.originalName}
                displayFileName={f.name}
                language={getLanguageFromFileName(f.name)}
                setSource={_params2().setSource}
                editActivation={_params2().editActivation}
                onActivate={_params2().onActivate}
                onBoundary={_params2().onBoundary}
                editable={_params2().editable}
                shouldHighlight={_params2().shouldHighlight}
                expanded={_params2().expanded}
                sourceProjection={f.sourceProjection}
              >
                {f.source}
              </Pre>
            )}
          </For>
        )),
      }));
    }

    // Otherwise, create files from original untransformed data
    const result: Array<{
      name: string;
      slug?: string;
      component: JSX.Element;
    }> = [];

    // Only add main file if it has a fileName
    const _mainSlug4 = _params2().mainSlug;
    const _selectedVariantKey5 = _params2().selectedVariantKey;
    const _fileName = _selectedVariant11.fileName;
    const _source = _selectedVariant11.source;
    if (_fileName && _source) {
      result.push({
        name: _fileName,
        slug: generateFileSlug(_mainSlug4, _fileName, _selectedVariantKey5),
        component: element(() => (
          <For
            each={[getPreRenderKey(generateFileSlug(_mainSlug4, _fileName, _selectedVariantKey5))]}
          >
            {() => (
              <Pre
                class={_params2().preClassName}
                fileName={_fileName}
                language={_selectedVariant11.language}
                setSource={_params2().setSource}
                editActivation={_params2().editActivation}
                onActivate={_params2().onActivate}
                onBoundary={_params2().onBoundary}
                editable={_params2().editable}
                shouldHighlight={_params2().shouldHighlight}
                fallback={_fileName ? resolvedFallbacks()[_fileName] : undefined}
                fallbackLineCounts={getVariantFileLineCounts(_selectedVariant11, _fileName)}
                expanded={_params2().expanded}
                sourceProjection={_selectedVariant11.sourceProjection}
              >
                {_source}
              </Pre>
            )}
          </For>
        )),
      });
    }
    if (_selectedVariant11.extraFiles) {
      Object.entries(_selectedVariant11.extraFiles).forEach(([fileName, fileData]) => {
        let source: VariantSource | undefined;
        let language: string | undefined;
        if (typeof fileData === 'string') {
          source = fileData;
        } else if (fileData && typeof fileData === 'object' && 'source' in fileData) {
          source = fileData.source;
          language = fileData.language;
        } else {
          return; // Skip invalid entries
        }
        if (!source) {
          return; // Skip null/undefined sources
        }
        result.push({
          name: fileName,
          slug: generateFileSlug(_params2().mainSlug, fileName, _params2().selectedVariantKey),
          component: element(() => (
            <For
              each={[
                getPreRenderKey(
                  generateFileSlug(_params2().mainSlug, fileName, _params2().selectedVariantKey),
                ),
              ]}
            >
              {() => (
                <Pre
                  class={_params2().preClassName}
                  fileName={fileName}
                  language={language ?? getLanguageFromFileName(fileName)}
                  setSource={_params2().setSource}
                  editActivation={_params2().editActivation}
                  onActivate={_params2().onActivate}
                  onBoundary={_params2().onBoundary}
                  editable={_params2().editable}
                  shouldHighlight={_params2().shouldHighlight}
                  fallback={resolvedFallbacks()[fileName]}
                  fallbackLineCounts={getVariantFileLineCounts(_selectedVariant11, fileName)}
                  expanded={_params2().expanded}
                  sourceProjection={
                    typeof fileData === 'object' && fileData !== null
                      ? fileData.sourceProjection
                      : undefined
                  }
                >
                  {source}
                </Pre>
              )}
            </For>
          )),
        });
      });
    }
    return result;
  });

  // Create a wrapper for selectFileName that handles transformed filenames and URL updates
  const selectFileName = (fileName: string) => {
    if (!_params2().selectedVariant) {
      return;
    }
    let targetFileName = fileName;

    // If we have transformed files, we need to reverse-lookup the original filename
    const _transformedFiles6 = _params2().transformedFiles;
    if (_transformedFiles6) {
      // Check if the fileName is a transformed name - if so, find the original
      const fileByTransformedName = _transformedFiles6.files.find((f) => f.name === fileName);
      if (fileByTransformedName) {
        targetFileName = fileByTransformedName.originalName;
      } else {
        // Check if the fileName is already an original name
        const fileByOriginalName = _transformedFiles6.files.find(
          (f) => f.originalName === fileName,
        );
        if (fileByOriginalName) {
          targetFileName = fileName;
        }
      }
    }

    // Handle hash removal based on fileHashMode
    const _mainSlug5 = _params2().mainSlug;
    const _saveVariantToLocalStorage = _params2().saveVariantToLocalStorage;
    const _selectedVariantKey6 = _params2().selectedVariantKey;
    const _setHash2 = _useUrlHashState2().setHash;
    if (
      typeof window !== 'undefined' &&
      isHashRelevantToDemo(_useUrlHashState2().hash, _mainSlug5)
    ) {
      // Save variant to localStorage if on-interaction mode (clicking a tab counts as interaction)
      if (
        _saveVariantToLocalStorage &&
        _params2().saveHashVariantToLocalStorage === 'on-interaction'
      ) {
        _saveVariantToLocalStorage(_selectedVariantKey6);
      }
      if (_params2().fileHashMode === 'remove-filename') {
        // Keep variant in hash: mainSlug or mainSlug:variant (for non-Default variants)
        const kebabMainSlug = toKebabCase(_mainSlug5);
        if (_selectedVariantKey6 === 'Default') {
          _setHash2(kebabMainSlug);
        } else {
          const kebabVariantName = toKebabCase(_selectedVariantKey6);
          _setHash2(`${kebabMainSlug}:${kebabVariantName}`);
        }
      } else {
        // Remove entire hash
        _setHash2(null);
      }
    }
    _params2().setSelectedFileNameInternal(targetFileName);
  };

  // Memoized array of all file slugs for all variants
  const allFilesSlugs = createMemo(() => {
    const result: Array<{
      fileName: string;
      slug: string;
      variantName: string;
    }> = [];
    const _effectiveCode2 = _params2().effectiveCode;
    const _variantKeys = _params2().variantKeys;
    if (!_effectiveCode2 || !_variantKeys.length) {
      return result;
    }

    // Iterate through all variants
    for (const variantKey of _variantKeys) {
      const variant = _effectiveCode2[variantKey];

      // Skip invalid variants
      if (!variant || typeof variant === 'string') {
        continue;
      }

      // Add variant-only slug (points to main file of the variant)
      // Skip for Default variant since it doesn't have variant name in hash
      if (variant.fileName && variantKey !== 'Default') {
        const kebabMainSlug = toKebabCase(_params2().mainSlug);
        const kebabVariantName = toKebabCase(variantKey);
        const variantOnlySlug = `${kebabMainSlug}:${kebabVariantName}`;
        result.push({
          fileName: variant.fileName,
          slug: variantOnlySlug,
          variantName: variantKey,
        });
      }

      // Add main file if it exists
      if (variant.fileName) {
        result.push({
          fileName: variant.fileName,
          slug: generateFileSlug(_params2().mainSlug, variant.fileName, variantKey),
          variantName: variantKey,
        });
      }

      // Add extra files
      if (variant.extraFiles) {
        Object.keys(variant.extraFiles).forEach((fileName) => {
          result.push({
            fileName,
            slug: generateFileSlug(_params2().mainSlug, fileName, variantKey),
            variantName: variantKey,
          });
        });
      }
    }
    return result;
  });
  return createMemo(() => {
    const _selectedFileLineCounts2 = selectedFileLineCounts();
    return {
      selectedFileName: selectedFileName(),
      selectedFileOriginalName: selectedFileOriginalName(),
      selectedFileUrl: selectedFileUrl(),
      selectedFileSlug: selectedFileSlug(),
      selectedFile: selectedFile(),
      selectedFileFallback: selectedFileFallback(),
      selectedFileComponent: selectedFileComponent(),
      selectedFileLines: selectedFileLines(),
      selectedFileFocusedLines: _params2().collapseToEmpty
        ? 0
        : (_selectedFileLineCounts2?.focusedLines ?? 0),
      selectedFileCollapsible: _selectedFileLineCounts2?.collapsible ?? false,
      selectedFileHasFocusProjection: selectedFileHasFocusProjection(),
      selectedFileSourceProjection: selectedFileSourceProjection(),
      files: files(),
      allFilesSlugs: allFilesSlugs(),
      selectFileName,
    };
  });
}
