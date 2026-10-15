import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import './SkipNav.css';

export const MAIN_CONTENT_ID = 'main-content';
const HREF = `#${MAIN_CONTENT_ID}`;
export function SkipNav(props: ReactProps<ComponentProps<'a'>>) {
  const rest = omit(props, 'class');
  return <a class={clsx('SkipNav', props.class)} href={HREF} {...rest} />;
}
