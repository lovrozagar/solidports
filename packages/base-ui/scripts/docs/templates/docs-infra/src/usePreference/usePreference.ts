// docs-infra's `usePreference`, kept by hand for Solid.
import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import useLocalStorageState from '../useLocalStorageState';
import { usePreferences } from './PreferencesProvider';

const variantPrefPrefix = '_docs_variant_pref';
const transformPref = '_docs_transform_pref';

/**
 * A preference kept in `localStorage`: the chosen variant (or transform) for a set of options.
 * `name` is the option set (a key, or the option names, joined sorted); a single option has no
 * choice to remember, so it is not stored.
 */
export function usePreference(
  type: Accessor<'variant' | 'transform'>,
  name: Accessor<string | string[]>,
  initializer: Accessor<string | null | (() => string | null)> = () => null,
) {
  const preferences = usePreferences();
  const storageKey = createMemo(() => {
    const value = name();
    let key: string | null;
    if (!Array.isArray(value)) {
      key = value;
    } else if (value.length <= 1) {
      key = null;
    } else {
      key = [...value].sort().join(':');
    }
    if (!key) {
      return null;
    }
    const prefix = preferences()?.prefix
      ? `${preferences()?.prefix}_${type()}`
      : type() === 'variant'
        ? variantPrefPrefix
        : transformPref;
    return `${prefix}:${key}`;
  });
  return useLocalStorageState(storageKey, initializer);
}
