import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import useLocalStorageState from '../useLocalStorageState';
import { usePreferences } from './PreferencesProvider';

const variantPrefPrefix = '_docs_variant_pref';
const transformPref = '_docs_transform_pref';

/**
 * Hook for specialized preference management for code demo variants and transformations.
 * Builds on `useLocalStorageState` with intelligent storage key generation, prefix support,
 * and automatic optimization for single-option scenarios.
 *
 * @param type - Type of preference, affects the storage key prefix
 * @param name - Variant/transform name(s). Arrays are sorted and joined to form the storage key.
 *   Single-element arrays disable persistence (no choice to remember).
 * @param initializer - Initial value or function returning initial value
 * @returns A tuple of [preference, setPreference] for reading and updating the preference
 */
export function usePreference(
  type: Accessor<'variant' | 'transform'>,
  name: Accessor<string | string[]>,
  _initializer?: Accessor<string | null | (() => string | null) | undefined>,
) {
  const initializer = createMemo(() => {
    const _initializer2 = _initializer?.();
    return _initializer2 === undefined ? null : _initializer2;
  });
  const key = createMemo(() => {
    const _name = name();
    if (!Array.isArray(_name)) {
      return _name;
    }
    if (_name.length <= 1) {
      return null; // Don't use localStorage for single variants - no choice to remember
    }
    return [..._name].sort().join(':');
  });
  const preferences = usePreferences();
  const defaultPrefix = createMemo(() =>
    type() === 'variant' ? variantPrefPrefix : transformPref,
  );
  const prefix = createMemo(() => {
    const _preferences = preferences();
    return _preferences?.prefix ? `${_preferences?.prefix}_${type()}` : defaultPrefix();
  });
  const storageKey = createMemo(() => {
    const _key = key();
    return _key ? `${prefix()}:${_key}` : null;
  });
  return useLocalStorageState(storageKey, initializer);
}
