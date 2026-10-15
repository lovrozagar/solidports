import { merge, omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';

export function Root(props: ReactProps<ComponentProps<'dl'>>) {
  return <dl {...props} class={clsx('DescriptionList', props.class)} />;
}
export function Term(
  _props: ReactProps<ComponentProps<'dt'>> & {
    separator?: boolean;
  },
) {
  const props = merge(
    {
      separator: false,
    },
    _props,
  );
  const rest = omit(props, 'separator');
  return (
    <dt {...rest} class={clsx('DescriptionTerm', props.separator && 'separator', rest.class)}>
      <Inner>{rest.children}</Inner>
    </dt>
  );
}
export function Details(props: ReactProps<ComponentProps<'dd'>>) {
  return (
    <dd {...props} class={clsx('DescriptionListDetails', props.class)}>
      <Inner>{props.children}</Inner>
    </dd>
  );
}
export function Item(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('DescriptionListItem', props.class)} />;
}
function Inner(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('DescriptionListInner', props.class)} />;
}
