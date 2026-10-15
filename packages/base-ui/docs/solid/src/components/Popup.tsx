import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import './Popup.css';

export function Popup(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'class');
  return <div class={clsx('Popup', props.class)} {...rest} />;
}
