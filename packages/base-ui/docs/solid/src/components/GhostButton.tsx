import { merge, omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import './GhostButton.css';

interface GhostButtonProps extends ReactProps<ComponentProps<'button'>> {
  layout?: 'text' | 'icon';
}
export function GhostButton(_props: GhostButtonProps) {
  const props = merge(
    {
      layout: 'text',
    },
    _props,
  );
  const rest = omit(props, 'class', 'layout');
  return (
    <button
      data-layout={props.layout}
      type="button"
      class={clsx('GhostButton', props.class)}
      {...rest}
    />
  );
}
