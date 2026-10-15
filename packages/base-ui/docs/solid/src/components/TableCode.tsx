import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { Code } from './Code';

export interface TableCodeProps extends ReactProps<ComponentProps<'code'>> {}

/** An inline code component for use in type tables */
export function TableCode(props: TableCodeProps) {
  const rest = omit(props, 'class');
  return <Code {...rest} class={clsx('TableCode', props.class)} />;
}
