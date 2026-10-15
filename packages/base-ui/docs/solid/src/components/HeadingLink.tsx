import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import './HeadingLink.css';

export function HeadingLink(props: ReactProps<ComponentProps<'a'>>) {
  const rest = omit(props, 'class', 'id');
  return <a class={clsx('HeadingLink', props.class)} href={`#${props.id}`} {...rest} />;
}
