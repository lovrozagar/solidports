import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { Code, VariantCode } from '../CodeHighlighter/types';
import { decodeHastSource } from '../pipeline/loadIsomorphicCodeVariant/decodeHastSource';
import { frameFallbackFromSpans } from '../pipeline/hastUtils';
import { getApplicableTransforms, getAvailableTransforms } from './useCodeUtils';
import type { CreateTransformedFiles, TransformRuntimeDeps } from './TransformEngine';
import {
  peekTransformEngine,
  preloadTransformEngine,
  resetTransformEngineCache,
} from './transformEngineCache';
import type { CodeHighlighterContextType } from '../CodeHighlighter/CodeHighlighterContext';
import { useCodeContext } from '../CodeProvider/CodeContext';
import { usePreference } from '../usePreference';

const transformRuntimeDeps: TransformRuntimeDeps = {
  decode: decodeHastSource,
  frameFallbackFromSpans,
};
export { preloadTransformEngine, resetTransformEngineCache };
interface UseTransformManagementProps {
  context?: CodeHighlighterContextType;
  effectiveCode: Code;
  selectedVariantKey: string;
  selectedVariant: VariantCode | null;
  initialTransform?: string;
  selectedTransform?: string | null;
  onSelectedTransformChange?: (transform: string | null) => void;
}
export interface UseTransformManagementResult {
  availableTransforms: string[];
  selectedTransform: string | null;
  transformedFiles: ReturnType<CreateTransformedFiles>;
  selectTransform: (transformName: string | null) => void;
}
type AppliedTransform = {
  variant: VariantCode | null;
  transform: string | null;
  result: ReturnType<CreateTransformedFiles>;
};

/**
 * Applies transforms immediately when the engine and highlighted source are
 * ready, retaining the previous result only while either dependency is cold.
 */
export function useTransformManagement(
  _params: Accessor<UseTransformManagementProps>,
): Accessor<UseTransformManagementResult> {
  const _params2 = createMemo(() => {
    const {
      context,
      effectiveCode,
      selectedVariantKey,
      selectedVariant,
      initialTransform,
      selectedTransform: controlledTransform,
      onSelectedTransformChange,
    } = _params();
    return {
      context,
      effectiveCode,
      selectedVariantKey,
      selectedVariant,
      initialTransform,
      controlledTransform,
      onSelectedTransformChange,
    };
  });
  const availableTransforms = createMemo(() => {
    const _context = _params2().context;
    if (_context?.availableTransforms?.length) {
      return _context.availableTransforms;
    }
    return getAvailableTransforms(_params2().effectiveCode, _params2().selectedVariantKey);
  });
  const contextAvailableTransforms = createMemo(() => _params2().context?.availableTransforms);
  const applicableFromCode = createMemo(() =>
    getApplicableTransforms(_params2().effectiveCode, _params2().selectedVariantKey),
  );
  const applicableTransforms = createMemo(() => {
    const _applicableFromCode = applicableFromCode();
    const _contextAvailableTransforms = contextAvailableTransforms();
    if (_applicableFromCode.length === 0 && _contextAvailableTransforms?.length) {
      return _contextAvailableTransforms;
    }
    return _applicableFromCode;
  });
  const _usePreference = usePreference(
    () => 'transform',
    () => {
      const _applicableTransforms = applicableTransforms();
      return _applicableTransforms.length === 1 ? _applicableTransforms[0] : _applicableTransforms;
    },
    () => () => null,
  );
  const _usePreference2 = createMemo(() => {
    const [storedValue, setStoredValue] = _usePreference();
    return {
      storedValue,
      setStoredValue,
    };
  });
  const resolveTransform = (value: string | null): string | null => {
    if (value !== null) {
      return value !== '' && applicableTransforms().includes(value) ? value : null;
    }
    const _initialTransform = _params2().initialTransform;
    return _initialTransform && applicableTransforms().includes(_initialTransform)
      ? _initialTransform
      : null;
  };
  let resolvedTransform: string | null;
  const _controlledTransform = untrack(_params2).controlledTransform;
  if (_controlledTransform !== undefined) {
    resolvedTransform =
      _controlledTransform && untrack(applicableTransforms).includes(_controlledTransform)
        ? _controlledTransform
        : null;
  } else {
    resolvedTransform = resolveTransform(untrack(_usePreference2).storedValue);
  }
  const [uncontrolledTransform, setUncontrolledTransform] = createSignal(() =>
    untrack(() => initialState(resolvedTransform)),
  );
  const [lastResolvedTransform, setLastResolvedTransform] = createSignal(() =>
    untrack(() => initialState(resolvedTransform)),
  );
  if (
    untrack(_params2).controlledTransform === undefined &&
    untrack(lastResolvedTransform) !== resolvedTransform
  ) {
    setLastResolvedTransform(resolvedTransform);
    setUncontrolledTransform(resolvedTransform);
  }
  const selectedTransform = createMemo(() =>
    _params2().controlledTransform === undefined ? uncontrolledTransform() : resolvedTransform,
  );
  const _useCodeContext = useCodeContext();
  const _useCodeContext2 = createMemo(() => {
    const { transformEngineLoader } = _useCodeContext();
    return {
      transformEngineLoader,
    };
  });
  const [transformEngine, setTransformEngine] = createSignal<CreateTransformedFiles | null>(() =>
    untrack(() => peekTransformEngine() ?? null),
  );
  createEffect(
    () => [
      transformEngine(),
      applicableTransforms().length,
      _useCodeContext2().transformEngineLoader,
    ],
    () => {
      if (transformEngine() || applicableTransforms().length === 0) {
        return undefined;
      }
      const warm = peekTransformEngine();
      if (warm) {
        setTransformEngine(() => warm);
        return undefined;
      }
      let cancelled = false;
      const _transformEngineLoader = _useCodeContext2().transformEngineLoader;
      (async () => {
        await preloadTransformEngine(_transformEngineLoader);
        if (!cancelled) {
          const loaded = peekTransformEngine();
          if (loaded) {
            setTransformEngine(() => loaded);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    },
  );
  const transformApplicable = createMemo(() => {
    const _selectedTransform = selectedTransform();
    return _selectedTransform === null || applicableFromCode().includes(_selectedTransform);
  });
  const canApply = createMemo(
    () =>
      !_params2().context?.deferHighlight &&
      (selectedTransform() === null || transformEngine() !== null) &&
      transformApplicable(),
  );
  const nextApplied = createMemo<AppliedTransform | null>(() => {
    if (!canApply()) {
      return null;
    }
    const _selectedVariant = _params2().selectedVariant;
    const _selectedTransform2 = selectedTransform();
    const _transformEngine = transformEngine();
    return {
      variant: _selectedVariant,
      transform: _selectedTransform2,
      result:
        _selectedTransform2 && _transformEngine
          ? _transformEngine(
              _selectedVariant,
              _selectedTransform2,
              transformRuntimeDeps,
              _params2().context?.fallbacks,
            )
          : undefined,
    };
  });
  const [lastApplied, setLastApplied] = createSignal<AppliedTransform | null>(() =>
    untrack(() => initialState(nextApplied())),
  );
  const _nextApplied = untrack(nextApplied);
  const _lastApplied = untrack(lastApplied);
  if (
    _nextApplied &&
    (_lastApplied?.variant !== _nextApplied.variant ||
      _lastApplied.transform !== _nextApplied.transform ||
      _lastApplied.result !== _nextApplied.result)
  ) {
    setLastApplied(_nextApplied);
  }
  const transformedFiles = createMemo(() =>
    transformApplicable() ? (nextApplied() ?? lastApplied())?.result : undefined,
  );
  const selectTransform = (value: string | null) => {
    const next = value === null || applicableTransforms().includes(value) ? value : null;
    if (next === selectedTransform()) {
      return;
    }
    if (_params2().controlledTransform !== undefined) {
      _params2().onSelectedTransformChange?.(next);
    } else {
      setUncontrolledTransform(next);
      _usePreference2().setStoredValue(next ?? '');
    }
  };
  return createMemo(() => ({
    availableTransforms: availableTransforms(),
    selectedTransform: selectedTransform(),
    transformedFiles: transformedFiles(),
    selectTransform,
  }));
}
