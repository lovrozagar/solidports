// docs-infra's `useCode`, kept by hand for Solid: the read-only path the docs use (precomputed
// variants, no transforms, enhancers or editing). It returns one object whose fields are getters,
// so a reader tracks only what it reads and a placed element is not rebuilt by unrelated state.
import { createEffect, createMemo, createSignal, onSettled, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { element } from 'docs/src/adapters/react';
import { useCodeHighlighterContextOptional } from '../CodeHighlighter/CodeHighlighterContext';
import type { Code, ContentProps, VariantCode, VariantSource } from '../CodeHighlighter/types';
import type { FallbackNode } from '../CodeHighlighter/fallbackFormat';
import { usePreference } from '../usePreference';
import { useUrlHashState } from '../useUrlHashState';
import { useCopier } from '../useCopier';
import type { UseCopierOpts } from '../useCopier';
import { stringOrHastToString } from '../pipeline/hastUtils';
import { decodeHastSource } from '../pipeline/loadIsomorphicCodeVariant/decodeHastSource';
import { countLines } from '../pipeline/parseSource/addLineGutters';
import { extractNameAndSlugFromUrl } from '../pipeline/loaderUtils/extractNameAndSlugFromUrl';
import { generateFileSlug } from '../pipeline/loaderUtils/generateFileSlug';
import { getLanguageFromExtension } from '../pipeline/loaderUtils/getLanguageFromExtension';
import { toKebabCase } from '../pipeline/loaderUtils/toKebabCase';
import { getVariantFileLineCounts } from './sourceLineCounts';
import type { SourceLineCounts } from './sourceLineCounts';
import { Pre } from './Pre';

export type UseCodeOpts = {
  /** Class of the `<pre>` the code renders in. */
  preClassName?: string;
  copy?: UseCopierOpts;
  /** The variant to show when no URL hash or stored preference picks one. */
  initialVariant?: string;
  /**
   * What selecting a file or variant does to a URL hash pointing at this demo: clear it, or
   * keep its demo and variant part.
   */
  fileHashMode?: 'remove-hash' | 'remove-filename';
  /** When a variant picked by the URL hash is saved as the preference. */
  saveHashVariantToLocalStorage?: 'on-load' | 'on-interaction' | 'never';
};

type UserProps<T extends {} = {}> = T & {
  name?: string;
  slug?: string;
};

export interface UseCodeFile {
  name: string;
  slug?: string;
  component: JSX.Element;
}

export interface UseCodeResult<T extends {} = {}> {
  readonly variants: string[];
  readonly selectedVariant: string;
  selectVariant: (variant: string | null) => void;
  readonly files: UseCodeFile[];
  /** The selected file's code, rendered where it is placed. */
  readonly selectedFile: JSX.Element;
  readonly selectedFileLines: number;
  readonly selectedFileFocusedLines: number;
  readonly selectedFileCollapsible: boolean;
  readonly selectedFileName: string | undefined;
  readonly selectedFileUrl: string | undefined;
  readonly selectedFileSlug: string | undefined;
  selectFileName: (fileName: string) => void;
  readonly allFilesSlugs: Array<{ fileName: string; slug: string; variantName: string }>;
  readonly expanded: boolean;
  expand: () => void;
  setExpanded: (expanded: boolean) => void;
  copy: (event: MouseEvent) => Promise<void>;
  readonly userProps: UserProps<T>;
}

/** Whether a URL hash points at this demo (`{slug}:…`). */
export function isHashRelevantToDemo(urlHash: string | null, mainSlug?: string): boolean {
  if (!urlHash || !mainSlug) {
    return false;
  }
  return urlHash.startsWith(`${toKebabCase(mainSlug)}:`);
}

/** The variant a URL hash (`slug:variant:file`, `slug:variant`, `slug:file`, `slug`) names. */
function parseVariantFromHash(urlHash: string | null, variantKeys: string[]): string | null {
  if (!urlHash) {
    return null;
  }
  const parts = urlHash.split(':');
  if (parts.length === 3) {
    return variantKeys.find((key) => toKebabCase(key) === parts[1].toLowerCase()) || null;
  }
  if (parts.length === 2) {
    const variant = variantKeys.find((key) => toKebabCase(key) === parts[1].toLowerCase());
    if (variant) {
      return variant;
    }
    if (parts[1].includes('.')) {
      return variantKeys.includes('Default') ? 'Default' : null;
    }
  }
  if (parts.length === 1) {
    return variantKeys.includes('Default') ? 'Default' : null;
  }
  return null;
}

function resolveVariantKey(
  hashVariant: string | null,
  storedValue: string | null,
  initialVariant: string | undefined,
  variantKeys: string[],
): string {
  if (hashVariant && variantKeys.includes(hashVariant)) {
    return hashVariant;
  }
  if (storedValue && variantKeys.includes(storedValue)) {
    return storedValue;
  }
  if (initialVariant && variantKeys.includes(initialVariant)) {
    return initialVariant;
  }
  return variantKeys[0] || '';
}

function getLanguageFromFileName(fileName: string | undefined): string | undefined {
  const lastDotIndex = fileName?.lastIndexOf('.') ?? -1;
  return lastDotIndex === -1 ? undefined : getLanguageFromExtension(fileName!.slice(lastDotIndex));
}

/** A file of a variant: its source, fallback and language. */
function variantFile(variant: VariantCode, fileName: string | undefined) {
  if (!fileName || fileName === variant.fileName) {
    return {
      source: variant.source ?? null,
      fallback: variant.fallback,
      language: variant.language ?? getLanguageFromFileName(variant.fileName),
    };
  }
  const extraFile = variant.extraFiles?.[fileName];
  if (typeof extraFile === 'string') {
    return { source: extraFile, fallback: undefined, language: getLanguageFromFileName(fileName) };
  }
  return {
    source: extraFile?.source ?? null,
    fallback: extraFile?.fallback,
    language: extraFile?.language ?? getLanguageFromFileName(fileName),
  };
}

export function useCode<T extends {} = {}>(
  contentProps: Accessor<ContentProps<T>>,
  opts: Accessor<UseCodeOpts | undefined> = () => undefined,
): Accessor<UseCodeResult<T>> {
  const context = useCodeHighlighterContextOptional();
  const options = () => opts() ?? {};
  const fileHashMode = () => options().fileHashMode ?? 'remove-hash';
  const saveHashVariant = () => options().saveHashVariantToLocalStorage ?? 'on-interaction';

  const effectiveCode = createMemo<Code>(() => context?.code || contentProps().code || {});

  const userProps = createMemo((): UserProps<T> => {
    const {
      name: contentName,
      slug: contentSlug,
      code: _code,
      components: _components,
      url: contentUrl,
      collapseToEmpty: _collapseToEmpty,
      initialExpanded: _initialExpanded,
      ...userDefinedProps
    } = contentProps();
    const url = context?.url || contentUrl;
    let name = contentName;
    let slug = contentSlug;
    if ((!name || !slug) && url) {
      try {
        const generated = extractNameAndSlugFromUrl(url);
        name = name || generated.name;
        slug = slug || generated.slug;
      } catch {
        // A URL without a recognizable name leaves them unset.
      }
    }
    return { ...userDefinedProps, name, slug } as UserProps<T>;
  });
  const mainSlug = () => userProps().slug ?? '';
  const collapseToEmpty = () => contentProps().collapseToEmpty === true;

  const hashState = useUrlHashState();
  const hash = () => hashState()[0];
  const setHash = (value: string | null) => hashState()[1](value);

  // Variants
  const variantKeys = createMemo(() =>
    Object.keys(effectiveCode()).filter((key) => {
      const variant = effectiveCode()[key];
      return variant && typeof variant === 'object' && 'source' in variant;
    }),
  );
  const hashVariant = createMemo(() => parseVariantFromHash(hash(), variantKeys()));
  const preference = usePreference(
    () => 'variant',
    () => contentProps().variantType || variantKeys(),
    () => () => null,
  );
  const storedVariant = () => preference()[0];
  const setStoredVariant = (value: string | null) => preference()[1](value);
  const resolvedVariant = createMemo(() =>
    resolveVariantKey(hashVariant(), storedVariant(), options().initialVariant, variantKeys()),
  );
  // The user's pick, until the hash, the preference or the initial variant resolves differently.
  const [selection, setSelection] = createSignal<string | null>(null);
  createEffect(resolvedVariant, () => {
    setSelection(null);
  });
  const selectedVariantKey = createMemo(() => {
    const picked = selection();
    return picked && variantKeys().includes(picked) ? picked : resolvedVariant();
  });
  const selectedVariant = createMemo<VariantCode | null>(() => {
    const variant = effectiveCode()[selectedVariantKey()];
    return variant && typeof variant === 'object' && 'source' in variant ? variant : null;
  });
  const selectVariant = (value: string | null) => {
    const next = value ?? variantKeys()[0];
    if (!next || !variantKeys().includes(next) || next === untrack(selectedVariantKey)) {
      return;
    }
    if (isHashRelevantToDemo(untrack(hash), untrack(mainSlug))) {
      setHash(null);
    }
    setSelection(next);
    setStoredVariant(next);
  };
  onSettled(() => {
    const variant = untrack(hashVariant);
    if (saveHashVariant() === 'on-load' && variant && variant !== untrack(storedVariant)) {
      setStoredVariant(variant);
    }
  });

  // Expansion: expanded from the start, or by a URL hash pointing at this demo.
  const [expanded, setExpandedState] = createSignal(
    untrack(() => contentProps().initialExpanded === true),
  );
  createEffect(
    () => isHashRelevantToDemo(hash(), mainSlug()),
    (relevant) => {
      if (relevant) {
        setExpandedState(true);
      }
    },
  );
  const expand = () => setExpandedState(true);
  const setExpanded = (next: boolean) => setExpandedState(next);

  // Files
  const [selectedFileNameState, setSelectedFileNameState] = createSignal<string | undefined>(
    undefined,
  );
  const selectedFileOriginalName = createMemo(
    () => selectedFileNameState() || selectedVariant()?.fileName,
  );
  // A URL hash naming a file of this demo selects it (and its variant).
  createEffect(
    () => hash(),
    (urlHash) => {
      if (!urlHash) {
        return;
      }
      const slug = untrack(mainSlug);
      for (const variantKey of untrack(variantKeys)) {
        const variant = untrack(effectiveCode)[variantKey];
        if (!variant || typeof variant === 'string') {
          continue;
        }
        const fileNames = [variant.fileName, ...Object.keys(variant.extraFiles ?? {})];
        const match = fileNames.find(
          (fileName) => fileName && generateFileSlug(slug, fileName, variantKey) === urlHash,
        );
        if (match) {
          setSelection(variantKey);
          setSelectedFileNameState(match);
          return;
        }
      }
    },
  );
  // A selected file the newly selected variant does not have falls back to its main file.
  createEffect(
    () => [selectedVariant(), selectedFileNameState()] as const,
    ([variant, fileName]) => {
      if (variant && fileName && fileName !== variant.fileName && !variant.extraFiles?.[fileName]) {
        setSelectedFileNameState(undefined);
      }
    },
  );
  // A variant change clears a URL hash pointing at this demo (or keeps its demo/variant part).
  createEffect(selectedVariantKey, (variantKey, previous) => {
    if (previous === undefined || variantKey === previous) {
      return;
    }
    const slug = untrack(mainSlug);
    if (!isHashRelevantToDemo(untrack(hash), slug) || untrack(hashVariant) === variantKey) {
      return;
    }
    if (untrack(fileHashMode) === 'remove-filename') {
      setHash(
        variantKey === 'Default'
          ? toKebabCase(slug)
          : `${toKebabCase(slug)}:${toKebabCase(variantKey)}`,
      );
    } else {
      setHash(null);
    }
  });

  const selectedFileData = createMemo(() => {
    const variant = selectedVariant();
    return variant ? variantFile(variant, selectedFileOriginalName()) : null;
  });
  const selectedFileSource = (): VariantSource | null => selectedFileData()?.source ?? null;
  const selectedFileFallback = (): FallbackNode[] | undefined => selectedFileData()?.fallback;
  const lineCounts = createMemo(() => {
    const variant = selectedVariant();
    const fileName = selectedFileOriginalName();
    return variant && fileName ? getVariantFileLineCounts(variant, fileName) : null;
  });
  const selectedFileSlug = createMemo(() => {
    const fileName = selectedFileOriginalName();
    return fileName ? generateFileSlug(mainSlug(), fileName, selectedVariantKey()) : undefined;
  });
  const selectedFileUrl = createMemo(() => {
    const variant = selectedVariant();
    const fileName = selectedFileOriginalName();
    if (!variant?.url) {
      return undefined;
    }
    if (!fileName || fileName === variant.fileName) {
      return variant.url;
    }
    const extraFile = variant.extraFiles?.[fileName];
    if (typeof extraFile === 'string') {
      return extraFile;
    }
    try {
      return new URL(extraFile?.relativeUrl ?? fileName, variant.url).href;
    } catch {
      return undefined;
    }
  });
  const selectedFileLines = createMemo(() => {
    const source = selectedFileSource();
    if (source == null) {
      return 0;
    }
    if (typeof source === 'string') {
      return source.split('\n').length;
    }
    const counts = lineCounts();
    if (('hastJson' in source || 'hastCompressed' in source) && counts && counts.totalLines > 0) {
      return counts.totalLines;
    }
    const decoded = decodeHastSource(source, selectedFileFallback());
    const totalLines = Number(decoded?.data?.totalLines);
    if (decoded?.data && 'totalLines' in decoded.data && totalLines >= 0) {
      return totalLines;
    }
    return decoded && 'children' in decoded ? countLines(decoded) : 0;
  });

  const shouldHighlight = () => !context?.deferHighlight && context?.highlightReady !== false;
  const preClassName = () => options().preClassName;

  /** A file's code view. */
  const renderFile = (
    data: ReturnType<typeof variantFile> | null,
    fileLineCounts: SourceLineCounts | null,
  ) => {
    if (!data?.source) {
      return null;
    }
    return (
      <Pre
        class={preClassName()}
        language={data.language}
        shouldHighlight={shouldHighlight()}
        fallback={data.fallback}
        fallbackLineCounts={fileLineCounts}
        collapseToEmpty={collapseToEmpty()}
      >
        {data.source}
      </Pre>
    );
  };
  // Remounted per file (upstream keys the view by file), so a file swap starts its view afresh.
  const selectedFileKey = createMemo(() =>
    selectedVariant()
      ? generateFileSlug(mainSlug(), selectedFileOriginalName() ?? 'code', selectedVariantKey())
      : undefined,
  );
  const selectedFile = element(() => (
    <Show when={selectedFileKey()} keyed>
      {(_fileKey) => renderFile(untrack(selectedFileData), untrack(lineCounts))}
    </Show>
  ));

  const files = createMemo<UseCodeFile[]>(() => {
    const variant = selectedVariant();
    if (!variant) {
      return [];
    }
    const result: UseCodeFile[] = [];
    const fileNames = [
      ...(variant.fileName && variant.source ? [variant.fileName] : []),
      ...Object.keys(variant.extraFiles ?? {}).filter(
        (fileName) => variantFile(variant, fileName).source,
      ),
    ];
    for (const fileName of fileNames) {
      const data = variantFile(variant, fileName);
      result.push({
        name: fileName,
        slug: generateFileSlug(mainSlug(), fileName, selectedVariantKey()),
        component: element(() => renderFile(data, getVariantFileLineCounts(variant, fileName))),
      });
    }
    return result;
  });

  const selectFileName = (fileName: string) => {
    if (!untrack(selectedVariant)) {
      return;
    }
    const slug = untrack(mainSlug);
    if (typeof window !== 'undefined' && isHashRelevantToDemo(untrack(hash), slug)) {
      const variantKey = untrack(selectedVariantKey);
      if (saveHashVariant() === 'on-interaction' && variantKey !== untrack(storedVariant)) {
        setStoredVariant(variantKey);
      }
      if (untrack(fileHashMode) === 'remove-filename') {
        setHash(
          variantKey === 'Default'
            ? toKebabCase(slug)
            : `${toKebabCase(slug)}:${toKebabCase(variantKey)}`,
        );
      } else {
        setHash(null);
      }
    }
    setSelectedFileNameState(fileName);
  };

  const allFilesSlugs = createMemo(() => {
    const result: Array<{ fileName: string; slug: string; variantName: string }> = [];
    for (const variantKey of variantKeys()) {
      const variant = effectiveCode()[variantKey];
      if (!variant || typeof variant === 'string') {
        continue;
      }
      if (variant.fileName && variantKey !== 'Default') {
        result.push({
          fileName: variant.fileName,
          slug: `${toKebabCase(mainSlug())}:${toKebabCase(variantKey)}`,
          variantName: variantKey,
        });
      }
      if (variant.fileName) {
        result.push({
          fileName: variant.fileName,
          slug: generateFileSlug(mainSlug(), variant.fileName, variantKey),
          variantName: variantKey,
        });
      }
      for (const fileName of Object.keys(variant.extraFiles ?? {})) {
        result.push({
          fileName,
          slug: generateFileSlug(mainSlug(), fileName, variantKey),
          variantName: variantKey,
        });
      }
    }
    return result;
  });

  const copier = useCopier(
    () => () => {
      const source = untrack(selectedFileSource);
      return source ? stringOrHastToString(source, untrack(selectedFileFallback)) : undefined;
    },
    () => options().copy,
  );

  const result: UseCodeResult<T> = {
    get variants() {
      return variantKeys();
    },
    get selectedVariant() {
      return selectedVariantKey();
    },
    selectVariant,
    get files() {
      return files();
    },
    selectedFile,
    get selectedFileLines() {
      return selectedFileLines();
    },
    get selectedFileFocusedLines() {
      return collapseToEmpty() ? 0 : (lineCounts()?.focusedLines ?? 0);
    },
    get selectedFileCollapsible() {
      return lineCounts()?.collapsible ?? false;
    },
    get selectedFileName() {
      return selectedFileOriginalName();
    },
    get selectedFileUrl() {
      return selectedFileUrl();
    },
    get selectedFileSlug() {
      return selectedFileSlug();
    },
    selectFileName,
    get allFilesSlugs() {
      return allFilesSlugs();
    },
    get expanded() {
      return expanded();
    },
    expand,
    setExpanded,
    copy: (event) => copier().copy(event),
    get userProps() {
      return userProps();
    },
  };
  return () => result;
}
