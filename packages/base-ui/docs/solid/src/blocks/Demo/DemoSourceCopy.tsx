import { cloneElement, reactRef } from 'docs/src/adapters/react';
import { createMemo, omit } from 'solid-js';
import type { PropsWithoutRef, ReactProps, Ref } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import copy from 'clipboard-copy';
import { useDemoContext } from './DemoContext';

export const DemoSourceCopy = function DemoSource(
  _props: PropsWithoutRef<DemoSourceCopy.Props> & {
    ref?: Ref<HTMLButtonElement>;
  },
) {
  const props = omit(_props, 'ref');
  const other = omit(props, 'onCopied', 'onError', 'onClick', 'render');
  const _useDemoContext = useDemoContext();
  const _useDemoContext2 = createMemo(() => {
    const { selectedFile } = _useDemoContext();
    return {
      selectedFile,
    };
  });
  const handleClick = async (
    event: MouseEvent & {
      currentTarget: HTMLButtonElement;
      target: Element;
    },
  ) => {
    try {
      await copy(_useDemoContext2().selectedFile.content);
      props.onCopied?.();
    } catch (error) {
      props.onError?.(error);
    }
    props.onClick?.(event);
  };
  const _render = createMemo(() => {
    if (!_useDemoContext2().selectedFile) {
      return null;
    }
    if (props.render) {
      return cloneElement(props.render, {
        ...other,
        onClick: handleClick,
        ref: _props.ref,
      });
    }
    return <button type="button" {...other} onClick={handleClick} ref={reactRef(_props.ref)} />;
  });
  return <>{_render()}</>;
};
export namespace DemoSourceCopy {
  export interface Props extends ReactProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>> {
    onCopied?: () => void;
    onError?: (error: unknown) => void;
    render?: JSX.Element;
  }
}
