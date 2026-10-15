import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import './Kbd.css';

export function Kbd(props: ReactProps<ComponentProps<'kbd'>>) {
  const rest = omit(props, 'class');
  return <kbd class={clsx('Kbd', props.class)} {...rest} />;
}
