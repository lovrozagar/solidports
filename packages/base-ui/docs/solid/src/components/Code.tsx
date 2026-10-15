import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';

export function Code(props: ReactProps<ComponentProps<'code'>>) {
  return <code {...props} class={clsx('Code', props.class)} />;
}
