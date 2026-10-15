import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { Code, VariantCode } from '../CodeHighlighter/types';
import { usePreference } from '../usePreference';
import { useUrlHashState } from '../useUrlHashState';
import { isHashRelevantToDemo } from './useFileNavigation';
import { toKebabCase } from '../pipeline/loaderUtils/toKebabCase';

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
interface UseVariantSelectionProps {
  effectiveCode: Code;
  initialVariant?: string;
  variantType?: string;
  mainSlug?: string;
  saveHashVariantToLocalStorage?: 'on-load' | 'on-interaction' | 'never';
  /** Keeps the last ready variant rendered while the highlighter is rebuilding. */
  deferHighlight?: boolean;
}
export interface UseVariantSelectionResult {
  variantKeys: string[];
  selectedVariantKey: string;
  selectedVariant: VariantCode | null;
  readyVariantKey: string;
  readyVariant: VariantCode | null;
  selectVariant: (value: string | null | ((prev: string | null) => string | null)) => void;
  selectVariantProgrammatic: (value: string | ((prev: string) => string)) => void;
  saveVariantToLocalStorage: (variant: string) => void;
  hashVariant: string | null;
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

/**
 * Manages variant intent and retains the last ready variant while highlighting
 * catches up. Warm selections render in the same update as the user action.
 */
export function useVariantSelection(
  _params: Accessor<UseVariantSelectionProps>,
): Accessor<UseVariantSelectionResult> {
  const _params2 = createMemo(() => {
    const {
      effectiveCode,
      initialVariant,
      variantType,
      mainSlug,
      saveHashVariantToLocalStorage = 'on-interaction',
      deferHighlight = false,
    } = _params();
    return {
      effectiveCode,
      initialVariant,
      variantType,
      mainSlug,
      saveHashVariantToLocalStorage,
      deferHighlight,
    };
  });
  const variantKeys = createMemo(() =>
    Object.keys(_params2().effectiveCode).filter((key) => {
      const variant = _params2().effectiveCode[key];
      return variant && typeof variant === 'object' && 'source' in variant;
    }),
  );
  const _useUrlHashState = useUrlHashState();
  const _useUrlHashState2 = createMemo(() => {
    const [urlHash, setUrlHash] = _useUrlHashState();
    return {
      urlHash,
      setUrlHash,
    };
  });
  const hashVariant = createMemo(() =>
    parseVariantFromHash(_useUrlHashState2().urlHash, variantKeys()),
  );
  const _usePreference = usePreference(
    () => 'variant',
    () => _params2().variantType || variantKeys(),
    () => () => null,
  );
  const _usePreference2 = createMemo(() => {
    const [storedValue, setStoredValue] = _usePreference();
    return {
      storedValue,
      setStoredValue,
    };
  });
  const resolvedValue = createMemo(() =>
    resolveVariantKey(
      hashVariant(),
      _usePreference2().storedValue,
      _params2().initialVariant,
      variantKeys(),
    ),
  );
  const [selection, setSelection] = createSignal(() => untrack(() => resolvedValue()));
  const [lastResolvedValue, setLastResolvedValue] = createSignal(() =>
    untrack(() => initialState(resolvedValue())),
  );
  const _resolvedValue = untrack(resolvedValue);
  if (untrack(lastResolvedValue) !== _resolvedValue) {
    setLastResolvedValue(_resolvedValue);
    setSelection(_resolvedValue);
  }
  const selectedVariantKey = createMemo(() => {
    const _selection = selection();
    return variantKeys().includes(_selection) ? _selection : resolvedValue();
  });
  const selectedVariant = createMemo(() => {
    const variant = _params2().effectiveCode[selectedVariantKey()];
    return variant && typeof variant === 'object' && 'source' in variant ? variant : null;
  });
  const initialReadyVariantKey = createMemo(() =>
    resolveVariantKey(hashVariant(), null, _params2().initialVariant, variantKeys()),
  );
  const [lastReadyVariantKey, setLastReadyVariantKey] = createSignal(() =>
    untrack(() => (_params2().deferHighlight ? initialReadyVariantKey() : selectedVariantKey())),
  );
  const nextReadyVariantKey = createMemo(() =>
    _params2().deferHighlight ? lastReadyVariantKey() : selectedVariantKey(),
  );
  const _selectedVariantKey = untrack(selectedVariantKey);
  if (!untrack(_params2).deferHighlight && untrack(lastReadyVariantKey) !== _selectedVariantKey) {
    setLastReadyVariantKey(_selectedVariantKey);
  }
  const readyVariantKey = createMemo(() => {
    const _nextReadyVariantKey = nextReadyVariantKey();
    return variantKeys().includes(_nextReadyVariantKey)
      ? _nextReadyVariantKey
      : selectedVariantKey();
  });
  const readyVariant = createMemo(() => {
    const variant = _params2().effectiveCode[readyVariantKey()];
    return variant && typeof variant === 'object' && 'source' in variant ? variant : null;
  });
  createEffect(
    () => [
      _params2().saveHashVariantToLocalStorage,
      hashVariant(),
      _usePreference2().storedValue,
      _usePreference2().setStoredValue,
    ],
    () => {
      const _hashVariant = hashVariant();
      if (
        _params2().saveHashVariantToLocalStorage === 'on-load' &&
        _hashVariant &&
        _hashVariant !== _usePreference2().storedValue
      ) {
        _usePreference2().setStoredValue(_hashVariant);
      }
    },
  );
  const selectVariant: (value: string | null | ((prev: string | null) => string | null)) => void = (
    value,
  ) => {
    const resolved = typeof value === 'function' ? value(selectedVariantKey()) : value;
    const next = resolved ?? variantKeys()[0];
    if (!next || !variantKeys().includes(next) || next === selectedVariantKey()) {
      return;
    }
    const _urlHash = _useUrlHashState2().urlHash;
    const _mainSlug = _params2().mainSlug;
    if (_urlHash && _mainSlug && isHashRelevantToDemo(_urlHash, _mainSlug)) {
      _useUrlHashState2().setUrlHash(null);
    }
    setSelection(next);
    _usePreference2().setStoredValue(next);
  };
  const selectVariantProgrammatic: (value: string | ((prev: string) => string)) => void = (
    value,
  ) => {
    const next = typeof value === 'function' ? value(selectedVariantKey()) : value;
    if (variantKeys().includes(next) && next !== selectedVariantKey()) {
      setSelection(next);
    }
  };
  const saveVariantToLocalStorage = (variant: string) => {
    if (
      _params2().saveHashVariantToLocalStorage === 'on-interaction' &&
      variant !== _usePreference2().storedValue
    ) {
      _usePreference2().setStoredValue(variant);
    }
  };
  return createMemo(() => ({
    variantKeys: variantKeys(),
    selectedVariantKey: selectedVariantKey(),
    selectedVariant: selectedVariant(),
    readyVariantKey: readyVariantKey(),
    readyVariant: readyVariant(),
    selectVariant,
    selectVariantProgrammatic,
    saveVariantToLocalStorage,
    hashVariant: hashVariant(),
  }));
}
