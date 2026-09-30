import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Fieldset } from '@solidports/base-ui/fieldset';

export function Root(props: Fieldset.Root.Props) {
  return <Fieldset.Root {...props} />;
}

export function Legend(props: Fieldset.Legend.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Fieldset.Legend class={clsx('text-sm font-medium text-gray-900', local.class)} {...others} />
  );
}
