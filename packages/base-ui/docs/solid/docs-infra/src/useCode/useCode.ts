import { createMemo, createSignal, createTrackedEffect, untrack } from 'solid-js';
import { createLayoutEffect } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCodeHighlighterContextOptional } from '../CodeHighlighter/CodeHighlighterContext';
import { useCodeContext } from '../CodeProvider/CodeContext';
import type {
  Code,
  ContentProps,
  ControlledCode,
  Fallbacks,
  SourceEnhancers,
  VariantSource,
  VariantCode,
} from '../CodeHighlighter/types';
import { useControlledCode } from '../CodeControllerContext';
import { extractNameAndSlugFromUrl } from '../pipeline/loaderUtils';
import { useVariantSelection } from './useVariantSelection';
import { useTransformManagement } from './useTransformManagement';
import { useFileNavigation } from './useFileNavigation';
import { useUIState } from './useUIState';
import { useCopyFunctionality } from './useCopyFunctionality';
import { useSourceEditing } from './useSourceEditing';
import { shouldHighlightForRender } from './useCodeUtils';
import type { UseCopierOpts } from '../useCopier';
import { stringOrHastToString } from '../pipeline/hastUtils';

function hasSourceChanges(
  controlledCode: ControlledCode | null,
  initialCode: Code | undefined,
  activeVariantKey: string,
  activeFallbacks: Fallbacks | undefined,
): boolean {
  if (!controlledCode) {
    return false;
  }
  const initialVariants = Object.entries(initialCode ?? {}).filter(
    (entry): entry is [string, VariantCode] => Boolean(entry[1]) && typeof entry[1] === 'object',
  );
  const controlledVariants = Object.entries(controlledCode).filter(
    ([, variant]) => variant !== null,
  );
  if (initialVariants.length !== controlledVariants.length) {
    return true;
  }
  for (const [variantKey, initialVariant] of initialVariants) {
    const controlledVariant = controlledCode[variantKey];
    const variantFallbacks = variantKey === activeVariantKey ? activeFallbacks : undefined;
    const toInitialSource = (source: VariantSource | null | undefined, fileName?: string) =>
      source == null
        ? source
        : stringOrHastToString(
            source,
            (fileName ? variantFallbacks?.[fileName] : undefined) ?? initialVariant.fallback,
          );
    if (
      !controlledVariant ||
      controlledVariant.source !== toInitialSource(initialVariant.source, initialVariant.fileName)
    ) {
      return true;
    }
    const initialFiles = Object.entries(initialVariant.extraFiles ?? {});
    const controlledFiles = Object.entries(controlledVariant.extraFiles ?? {});
    if (initialFiles.length !== controlledFiles.length) {
      return true;
    }
    for (const [fileName, initialFile] of initialFiles) {
      let initialSource: string | null | undefined;
      if (typeof initialFile === 'string') {
        initialSource = initialFile;
      } else if (initialFile.source == null) {
        initialSource = initialFile.source;
      } else {
        initialSource = stringOrHastToString(
          initialFile.source,
          variantFallbacks?.[fileName] ?? initialFile.fallback,
        );
      }
      if (controlledVariant.extraFiles?.[fileName]?.source !== initialSource) {
        return true;
      }
    }
  }
  return false;
}
export type ActionSource = 'current' | 'initial';
export type UseCodeOpts = {
  preClassName?: string;
  copy?: UseCopierOpts;
  githubUrlPrefix?: string;
  initialVariant?: string;
  initialTransform?: string;
  /**
   * Controls hash removal behavior when user interacts with file tabs:
   * - 'remove-hash': Remove entire hash (default)
   * - 'remove-filename': Remove only filename, keep variant in hash
   */
  fileHashMode?: 'remove-hash' | 'remove-filename';
  /**
   * Controls when to save hash variant to localStorage:
   * - 'on-load': Save immediately when page loads with hash
   * - 'on-interaction': Save only when user clicks a tab (default)
   * - 'never': Never save hash variant to localStorage
   */
  saveHashVariantToLocalStorage?: 'on-load' | 'on-interaction' | 'never';
  /**
   * Array of enhancer functions to apply to parsed HAST sources.
   * Enhancers receive the HAST root, comments extracted from source, and filename.
   * Runs asynchronously when code changes.
   */
  sourceEnhancers?: SourceEnhancers;
  /**
   * Disables editing of the code block even when a CodeControllerContext is present.
   */
  disabled?: boolean;
  /**
   * Called when the code block is asked to expand its collapsed window — most
   * importantly from the editor itself, when the caret navigates past the
   * visible region (e.g. `ArrowUp` at the top of a collapsed block). Fires
   * synchronously, *before* the expansion re-renders, so a host can capture the
   * still-collapsed layout and engage a scroll anchor (e.g. `useCodeWindow`'s
   * `anchorScroll('expand')`) — matching the timing of a click on the expand
   * toggle. Without this, keyboard-driven expansion would jump the viewport
   * instead of smoothly anchoring it.
   */
  onExpand?: () => void;
  /**
   * Discards all controller-owned edits before a collapsed focused source is
   * expanded. The selected variant, file, and transform are preserved.
   */
  resetOnExpand?: boolean;
  /**
   * Selects whether copy and export actions use controlled source or the
   * initial repository source. Defaults to `'current'`.
   */
  actionSource?: ActionSource;
  /**
   * Controls the selected transform. When supplied, internal stored transform
   * preferences do not override this value.
   */
  selectedTransform?: string | null;
  /** Called when a transform is selected in controlled mode. */
  onSelectedTransformChange?: (transform: string | null) => void;
};
type UserProps<T extends {} = {}> = T & {
  name?: string;
  slug?: string;
};
export interface UseCodeResult<T extends {} = {}> {
  variants: string[];
  selectedVariant: string;
  selectVariant: (variant: string | null) => void;
  files: Array<{
    name: string;
    slug?: string;
    component: JSX.Element;
  }>;
  selectedFile: JSX.Element;
  selectedFileLines: number;
  /** Number of source lines shown by the collapsed editor. */
  selectedFileFocusedLines: number;
  /** Whether the selected file has distinct collapsed and complete views. */
  selectedFileCollapsible: boolean;
  /** Whether collapsed editing uses a contiguous focused projection. */
  selectedFileHasFocusProjection: boolean;
  /** Canonical repository filename before a transform renames the display. */
  selectedFileOriginalName: string | undefined;
  selectedFileName: string | undefined;
  /**
   * URL of the currently selected file, derived from the selected variant's
   * `url`, the file's name, and its `relativeUrl` (when set). `undefined` when
   * the variant has no `url` or the URL cannot be resolved.
   */
  selectedFileUrl: string | undefined;
  /**
   * Slug for the currently selected file. Always derived from the canonical
   * (original) file name — transforms are a view preference and do not
   * produce separate slugs. Useful for building permalinks (e.g. `#${slug}`)
   * that survive transform changes.
   */
  selectedFileSlug: string | undefined;
  selectFileName: (fileName: string) => void;
  allFilesSlugs: Array<{
    fileName: string;
    slug: string;
    variantName: string;
  }>;
  expanded: boolean;
  expand: () => void;
  setExpanded: (expanded: boolean) => void;
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
  availableTransforms: string[];
  selectedTransform: string | null | undefined;
  selectTransform: (transformName: string | null) => void;
  /** Whether the surrounding controller currently owns edited source. */
  hasControlledEdits: boolean;
  /**
   * Whether edit mode is currently on. `true` by default; starts `false` when the block
   * opts in via `initialDisabled` — per demo through the `createDemo` `meta`, or across a
   * factory's demos through `createDemoFactory`. While `false` the block renders
   * read-only and the live-editing engine is not even warmed; flip it with
   * {@link setEditable}. Independent of `editActivation`, which governs *when* the engine
   * loads once editing is on, and of `disabled`, which turns editing off permanently.
   */
  editable: boolean;
  /**
   * Turns edit mode on or off. `undefined` when the block can't be edited at all — no
   * `CodeControllerContext` with `setCode` in scope, or editing is hard-`disabled` — so
   * a toggle button can render only when this is defined. Toggling off keeps the
   * reader's edits (use {@link reset} to discard them).
   */
  setEditable?: (editable: boolean) => void;
  /**
   * Replace the source of the currently selected file (or `fileName` when
   * provided) in the controlled code. Internal hooks may pass additional
   * arguments (caret position, pre-parsed HAST) that are not part of the
   * public contract.
   */
  setSource?: (source: string, fileName?: string) => void;
  /**
   * Clears the entire controlled code state back to `undefined`, discarding
   * user edits across **all variants and files** owned by the surrounding
   * `CodeControllerContext` (not just the currently selected file or
   * variant). Only available when a `CodeControllerContext` with `setCode`
   * is in scope and editing is not disabled.
   */
  reset?: () => void;
  /**
   * Re-fetches the block's data on the client by re-running the full variant
   * loader, then swaps in the fresh result while keeping the current highlighted
   * output visible until the new tree lands (stale-while-revalidate). Invalidates
   * the pre-parsed HAST cache. `undefined` (or a no-op) for a block with no `url`
   * to re-fetch from, or with no `CodeProvider` in scope.
   */
  refresh?: () => void;
  userProps: UserProps<T>;
}
export function useCode<T extends {} = {}>(
  contentProps: Accessor<ContentProps<T>>,
  opts?: Accessor<UseCodeOpts | undefined>,
): Accessor<UseCodeResult<T>> {
  const _value = createMemo(() => {
    const {
      copy: copyOpts,
      initialVariant,
      initialTransform,
      preClassName,
      fileHashMode = 'remove-hash',
      saveHashVariantToLocalStorage = 'on-interaction',
      sourceEnhancers,
      disabled,
      onExpand,
      resetOnExpand = false,
      actionSource = 'current',
      selectedTransform,
      onSelectedTransformChange,
    } = opts?.() || {};
    return {
      copyOpts,
      initialVariant,
      initialTransform,
      preClassName,
      sourceEnhancers,
      disabled,
      onExpand,
      selectedTransform,
      onSelectedTransformChange,
      fileHashMode,
      saveHashVariantToLocalStorage,
      resetOnExpand,
      actionSource,
    };
  });
  // Safely try to get context values - will be undefined if not in context
  const context = useCodeHighlighterContextOptional();
  const codeContext = useCodeContext();
  const controllerContext = useControlledCode();

  // Merge enhancers from CodeProvider, CodeControllerContext, and useCode opts.
  // Provider enhancers run first so they match the order applied by
  // `loadPrecomputedCodeHighlighter` on the server, then controller and
  // per-call enhancers layer on top. This lets a single `<CodeProvider>`
  // configure the baseline (e.g., `@highlight` / `@focus` framing) while
  // individual `useCode` callers add demo-specific extras without losing the
  // shared defaults.
  // Hoist the optional controller member into a stable local so the memo's
  // inferred dependency matches the source dependency. `useControlledCode()`
  // always returns a fresh object, so `controllerContext` is never null but
  // changes identity every render; depending on the narrowed value keeps the
  // memo correct (and lets the compiler preserve the manual memoization).
  const controllerEnhancers = createMemo(() => controllerContext()?.sourceEnhancers);
  const mergedEnhancers = createMemo((): SourceEnhancers | undefined => {
    const enhancers: SourceEnhancers = [];
    const _codeContext = codeContext();
    if (_codeContext.sourceEnhancers) {
      enhancers.push(..._codeContext.sourceEnhancers);
    }
    const _controllerEnhancers = controllerEnhancers();
    if (_controllerEnhancers) {
      enhancers.push(..._controllerEnhancers);
    }
    const _sourceEnhancers = _value().sourceEnhancers;
    if (_sourceEnhancers) {
      enhancers.push(..._sourceEnhancers);
    }
    return enhancers.length > 0 ? enhancers : undefined;
  });

  // Prefer controller state because context can lag while controlled source is seeded.
  const controlledCode = createMemo(() => controllerContext()?.code);
  const effectiveCode = createMemo(() => {
    const _controlledCode = controlledCode();
    if (_controlledCode) {
      return Object.fromEntries(
        Object.entries(_controlledCode).filter((entry) => entry[1] != null),
      ) as Code;
    }
    return context()?.code || contentProps().code || {};
  });
  const initialCode = createMemo(() => {
    const _context = context();
    return contentProps().code ?? _context?.initialCode ?? _context?.code;
  });

  // Memoize userProps with auto-generated name and slug if missing
  const userProps = createMemo((): UserProps<T> => {
    // Extract only the user-defined properties (T) from contentProps
    const {
      name: contentName,
      slug: contentSlug,
      code,
      components,
      url: contentUrl,
      // `collapseToEmpty` / `initialExpanded` are render-time display flags, not
      // user-facing props — strip them (rest siblings) so they don't leak into
      // the demo's props.
      collapseToEmpty: collapseToEmptyContentProp,
      initialExpanded: initialExpandedContentProp,
      ...userDefinedProps
    } = contentProps();
    // Get URL from context first, then fall back to contentProps
    const effectiveUrl = context()?.url || contentUrl;
    let name = contentName;
    let slug = contentSlug;
    // Generate name and slug from URL if they're missing and we have a URL
    if ((!name || !slug) && effectiveUrl) {
      try {
        const generated = extractNameAndSlugFromUrl(effectiveUrl);
        name = name || generated.name;
        slug = slug || generated.slug;
      } catch {
        // If URL parsing fails, keep the original values (which might be undefined)
      }
    }
    return {
      ...userDefinedProps,
      name,
      slug,
    } as UserProps<T>;
  });

  // Resolve the render-time display flags. They must come from `contentProps`
  // (threaded by the demo factory / `CodeHighlighter` / code transforms) rather
  // than `useCode` opts: the loading fallback derives its own copy from the same
  // `contentProps`, so a per-call opt would let the live render and the fallback
  // disagree.
  const collapseToEmpty = createMemo(() => contentProps().collapseToEmpty === true);
  const initialExpanded = createMemo(() => contentProps().initialExpanded === true);
  const initialDisabled = createMemo(() => contentProps().initialDisabled === true);

  // Sub-hook: UI State Management (needs slug to check for relevant hash)
  const hashExpandRef: {
    current: () => void;
  } = {
    current: () => {},
  };
  const expandFromHash = () => hashExpandRef.current();
  const uiState = useUIState(() => ({
    initialExpanded: initialExpanded(),
    initialDisabled: initialDisabled(),
    mainSlug: userProps().slug,
    onExpand: expandFromHash,
  }));

  // `useFileNavigation` consumes this value as controlled state so the
  // selected file survives transform renames and variant updates.
  const [selectedFileNameState, setSelectedFileNameState] = createSignal<string | undefined>(
    undefined,
  );

  // Sub-hook: Variant Selection
  const variantSelection = useVariantSelection(() => ({
    effectiveCode: effectiveCode(),
    initialVariant: _value().initialVariant,
    variantType: contentProps().variantType,
    mainSlug: userProps().slug,
    saveHashVariantToLocalStorage: _value().saveHashVariantToLocalStorage,
    deferHighlight: context()?.deferHighlight,
  }));

  // Seed the selected file name from the variant's main file the
  // first time the variant resolves. Subsequent file selections come
  // through `useFileNavigation`'s controlled setter. Set-state during
  // render triggers one extra render on first mount; we accept that
  // cost because the alternative (lazy `useState` initializer)
  // requires resolving the variant key here, which depends on
  // `useUrlHashState` / `usePreference` hooks that already live
  // inside `useVariantSelection`. Duplicating them at this level
  // would be worse than the extra render.
  const _variantSelection = untrack(variantSelection);
  if (untrack(selectedFileNameState) === undefined && _variantSelection.selectedVariant?.fileName) {
    setSelectedFileNameState(_variantSelection.selectedVariant.fileName);
  }
  const shouldHighlight = createMemo(() =>
    shouldHighlightForRender({
      deferHighlight: context()?.deferHighlight,
      highlightReady: context()?.highlightReady,
    }),
  );

  // Keep rendering the last ready variant while the highlighter rebuilds.
  const renderedVariant = createMemo(() => {
    const _variantSelection2 = variantSelection();
    return _variantSelection2.readyVariant ?? _variantSelection2.selectedVariant;
  });
  const renderedVariantKey = createMemo(() => {
    const _variantSelection3 = variantSelection();
    return _variantSelection3.readyVariantKey || _variantSelection3.selectedVariantKey;
  });

  // Sub-hook: Transform Management
  const transformManagement = useTransformManagement(() => ({
    context: context(),
    effectiveCode: effectiveCode(),
    selectedVariantKey: renderedVariantKey(),
    selectedVariant: renderedVariant(),
    initialTransform: _value().initialTransform,
    selectedTransform: _value().selectedTransform,
    onSelectedTransformChange: _value().onSelectedTransformChange,
  }));

  // Sub-hook: Source Editing
  const sourceEditing = useSourceEditing(() => ({
    context: context(),
    selectedVariantKey: renderedVariantKey(),
    effectiveCode: effectiveCode(),
    selectedVariant: renderedVariant(),
    disabled: _value().disabled,
  }));
  const rawSetExpanded = createMemo(() => uiState().setExpanded);
  const onExpandRef = {
    current: untrack(_value).onExpand,
  };
  createTrackedEffect(() => {
    onExpandRef.current = _value().onExpand;
  });
  const controllerSetCode = createMemo(() => controllerContext()?.setCode);
  const sourceEditingReset = createMemo(() => sourceEditing().reset);
  const resetSource = () => {
    const _sourceEditingReset = sourceEditingReset();
    if (_sourceEditingReset) {
      _sourceEditingReset();
    } else {
      controllerSetCode()?.(null);
    }
  };
  const expand = () => {
    if (uiState().expanded) {
      return;
    }
    onExpandRef.current?.();
    if (_value().resetOnExpand) {
      resetSource?.();
    }
    rawSetExpanded()(true);
  };
  createLayoutEffect(
    () => [expand],
    () => {
      hashExpandRef.current = expand;
    },
  );
  const setExpanded = (nextExpanded: boolean) => {
    if (nextExpanded) {
      expand();
    } else {
      rawSetExpanded()(false);
    }
  };
  const sourceEditingActivate = createMemo(() => sourceEditing().activate);
  const onEditingActivated = createMemo(() => context()?.onEditingActivated);
  const activateEditing = () => {
    sourceEditingActivate()?.();
    onEditingActivated()?.();
  };

  // Whether the reader has edited the source. `useFileNavigation` needs it to
  // tell a live source projection from a precomputed one, and `selectTransform`
  // to know whether there are edits to discard.
  const hasControlledEdits = createMemo(() =>
    hasSourceChanges(
      controllerContext()?.code ?? null,
      initialCode(),
      renderedVariantKey(),
      context()?.fallbacks,
    ),
  );

  // Sub-hook: File Navigation
  const fileNavigation = useFileNavigation(() => ({
    hasControlledEdits: hasControlledEdits(),
    selectedVariant: renderedVariant(),
    transformedFiles: transformManagement().transformedFiles,
    selectedTransform: transformManagement().selectedTransform,
    mainSlug: userProps().slug,
    selectedVariantKey: renderedVariantKey(),
    selectVariant: variantSelection().selectVariantProgrammatic,
    variantKeys: variantSelection().variantKeys,
    shouldHighlight: shouldHighlight(),
    preClassName: _value().preClassName,
    setSource: sourceEditing().setSource,
    editActivation: context()?.editActivation,
    onActivate: activateEditing,
    onBoundary: expand,
    editable: uiState().editable,
    effectiveCode: effectiveCode(),
    fileHashMode: _value().fileHashMode,
    saveHashVariantToLocalStorage: _value().saveHashVariantToLocalStorage,
    saveVariantToLocalStorage: variantSelection().saveVariantToLocalStorage,
    hashVariant: variantSelection().hashVariant,
    sourceEnhancers: mergedEnhancers(),
    fallbacks: context()?.fallbacks,
    expanded: uiState().expanded,
    collapseToEmpty: collapseToEmpty(),
    selectedFileName: selectedFileNameState(),
    setSelectedFileName: setSelectedFileNameState,
  }));

  // Sub-hook: Copy Functionality
  const initialActionCode = createMemo(() => initialCode()?.[renderedVariantKey()]);
  const initialActionVariant = createMemo(() => {
    const _initialActionCode = initialActionCode();
    return _initialActionCode && typeof _initialActionCode === 'object' ? _initialActionCode : null;
  });
  const copyFunctionality = useCopyFunctionality(() => ({
    selectedFile: fileNavigation().selectedFile,
    selectedVariant: renderedVariant(),
    transformedFiles: transformManagement().transformedFiles,
    // Per-file dictionaries for the active variant (decodes `hastCompressed`
    // sources back to text); `selectedFileFallback` covers the single-file copy.
    fallbacks: context()?.fallbacks,
    selectedFileFallback: fileNavigation().selectedFileFallback,
    title: userProps().name,
    copyOpts: _value().copyOpts,
    actionSource: _value().actionSource,
    initialVariant: initialActionVariant(),
    selectedFileName: fileNavigation().selectedFileOriginalName,
    selectedTransform: transformManagement().selectedTransform,
    transformEngineLoader: codeContext().transformEngineLoader,
  }));

  // Editing can be toggled only where it's possible at all: a controller with `setCode`
  // is in scope and the block isn't hard-`disabled`. Otherwise `setEditable` is omitted,
  // so a host renders no toggle.
  const canToggleEditing = createMemo(
    () => Boolean(controllerContext()?.setCode) && !_value().disabled,
  );

  // Discard live edits when the reader switches language.
  const rawSelectTransform = createMemo(() => transformManagement().selectTransform);
  const selectTransform = (transformName: string | null) => {
    if (hasControlledEdits()) {
      resetSource?.();
    }
    rawSelectTransform()(transformName);
  };
  return createMemo(() => {
    const _variantSelection4 = variantSelection();
    const _fileNavigation = fileNavigation();
    const _uiState = uiState();
    const _copyFunctionality = copyFunctionality();
    const _transformManagement = transformManagement();
    const _sourceEditing = sourceEditing();
    return {
      variants: _variantSelection4.variantKeys,
      selectedVariant: _variantSelection4.selectedVariantKey,
      selectVariant: _variantSelection4.selectVariant,
      files: _fileNavigation.files,
      selectedFile: _fileNavigation.selectedFileComponent,
      selectedFileLines: _fileNavigation.selectedFileLines,
      selectedFileFocusedLines: _fileNavigation.selectedFileFocusedLines,
      selectedFileCollapsible: _fileNavigation.selectedFileCollapsible,
      selectedFileHasFocusProjection: _fileNavigation.selectedFileHasFocusProjection,
      selectedFileOriginalName: _fileNavigation.selectedFileOriginalName,
      selectedFileName: _fileNavigation.selectedFileName,
      selectedFileUrl: _fileNavigation.selectedFileUrl,
      selectedFileSlug: _fileNavigation.selectedFileSlug,
      selectFileName: _fileNavigation.selectFileName,
      allFilesSlugs: _fileNavigation.allFilesSlugs,
      expanded: _uiState.expanded,
      expand,
      setExpanded,
      copy: _copyFunctionality.copy,
      copyMarkdown: _copyFunctionality.copyMarkdown,
      availableTransforms: _transformManagement.availableTransforms,
      selectedTransform: _transformManagement.selectedTransform,
      selectTransform,
      hasControlledEdits: hasControlledEdits(),
      editable: _uiState.editable,
      setEditable: canToggleEditing() ? _uiState.setEditable : undefined,
      setSource: _sourceEditing.setSource,
      reset: _sourceEditing.reset,
      refresh: context()?.refresh,
      userProps: userProps(),
    };
  });
}
