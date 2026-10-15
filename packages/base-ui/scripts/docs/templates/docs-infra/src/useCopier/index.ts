// docs-infra's `useCopier`, kept by hand for Solid.
import { createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import copyToClipboard from 'clipboard-copy';

export type UseCopierOpts = {
  onCopied?: () => void;
  onError?: (error: unknown) => void;
  onClick?: (event: MouseEvent) => void;
  /** How long `recentlySuccessful` stays true after a copy, in milliseconds. */
  timeout?: number;
};

/** Copies `contents` (or what it returns) to the clipboard. */
export function useCopier(
  contents: Accessor<(() => string | undefined) | string>,
  opts: Accessor<UseCopierOpts | undefined> = () => undefined,
): Accessor<{ copy: (event: MouseEvent) => Promise<void>; recentlySuccessful: boolean }> {
  const [recentlySuccessful, setRecentlySuccessful] = createSignal(false);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timeout));
  const copy = async (event: MouseEvent) => {
    const { onCopied, onError, onClick, timeout: duration = 2000 } = opts() ?? {};
    clearTimeout(timeout);
    setRecentlySuccessful(false);
    try {
      const value = contents();
      const content = typeof value === 'function' ? value() : value;
      if (content) {
        await copyToClipboard(content);
      }
      setRecentlySuccessful(true);
      onCopied?.();
      timeout = setTimeout(() => setRecentlySuccessful(false), duration);
    } catch (error) {
      onError?.(error);
    }
    onClick?.(event);
  };
  const result = {
    copy,
    get recentlySuccessful() {
      return recentlySuccessful();
    },
  };
  return () => result;
}
