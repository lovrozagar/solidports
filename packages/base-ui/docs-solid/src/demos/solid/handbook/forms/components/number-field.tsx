import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { NumberField } from '@solidports/base-ui/number-field';

export function Root(props: NumberField.Root.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <NumberField.Root class={clsx('flex flex-col items-start gap-1', local.class)} {...others} />
  );
}

export function Group(props: NumberField.Group.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <NumberField.Group class={clsx('flex', local.class)} {...others} />;
}

export function Decrement(props: NumberField.Decrement.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <NumberField.Decrement
      class={clsx(
        'flex size-10 items-center justify-center rounded-tl-md rounded-bl-md border border-gray-200 bg-gray-50 bg-clip-padding text-gray-900 select-none hover:bg-gray-100 active:bg-gray-100',
        local.class,
      )}
      {...others}
    />
  );
}

export function Input(props: NumberField.Input.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <NumberField.Input
      class={clsx(
        'h-10 w-24 border-t border-b border-gray-200 text-center text-base text-gray-900 tabular-nums focus:z-1 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800',
        local.class,
      )}
      {...others}
    />
  );
}

export function Increment(props: NumberField.Increment.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <NumberField.Increment
      class={clsx(
        'flex size-10 items-center justify-center rounded-tr-md rounded-br-md border border-gray-200 bg-gray-50 bg-clip-padding text-gray-900 select-none hover:bg-gray-100 active:bg-gray-100',
        local.class,
      )}
      {...others}
    />
  );
}
