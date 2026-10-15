import { createMemo, createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import copyToClipboard from 'clipboard-copy';

type OnCopied = () => void;
type OnCopyError = (error: unknown) => void;
type OnCopyClick = (
  event: MouseEvent & {
    currentTarget: Element;
    target: Element;
  },
) => void;
export type UseCopierOpts = {
  onCopied?: OnCopied;
  onError?: OnCopyError;
  onClick?: OnCopyClick;
  timeout?: number;
};
export function useCopier(
  contents: Accessor<(() => string | undefined) | string>,
  opts?: Accessor<UseCopierOpts | undefined>,
) {
  const _value = createMemo(() => {
    const { onCopied, onError, onClick, timeout = 2000 } = opts?.() || {};
    return {
      onCopied,
      onError,
      onClick,
      timeout,
    };
  });
  const copyTimeoutRef: {
    current: ReturnType<typeof setTimeout> | undefined;
  } = {
    current: undefined,
  };
  const [recentlySuccessful, setRecentlySuccessful] = createSignal(false);
  const copy = async (
    event: MouseEvent & {
      currentTarget: Element;
      target: Element;
    },
  ) => {
    clearTimeout(copyTimeoutRef.current);
    setRecentlySuccessful(false);
    try {
      const _contents = contents();
      const content = typeof _contents === 'function' ? _contents() : _contents;
      if (content) {
        await copyToClipboard(content);
      }
      setRecentlySuccessful(true);
      _value().onCopied?.();
      copyTimeoutRef.current = setTimeout(() => {
        clearTimeout(copyTimeoutRef.current);
        setRecentlySuccessful(false);
      }, _value().timeout);
    } catch (error) {
      _value().onError?.(error);
    }
    _value().onClick?.(event);
  };
  return createMemo(() => ({
    copy,
    recentlySuccessful: recentlySuccessful(),
  }));
}
