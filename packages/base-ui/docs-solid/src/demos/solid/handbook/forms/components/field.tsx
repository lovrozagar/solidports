import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Field } from '@solidports/base-ui/field';

export function Root(props: Field.Root.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Field.Root class={clsx('flex flex-col items-start gap-1', local.class)} {...others} />;
}

export function Label(props: Field.Label.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Field.Label
      class={clsx(
        'text-sm font-medium text-gray-900 has-[[role="checkbox"]]:flex has-[[role="checkbox"]]:items-center has-[[role="checkbox"]]:gap-2 has-[[role="radio"]]:flex has-[[role="radio"]]:items-center has-[[role="radio"]]:gap-2 has-[[role="switch"]]:flex has-[[role="switch"]]:items-center has-[[role="radio"]]:font-normal',
        local.class,
      )}
      {...others}
    />
  );
}

export function Description(props: Field.Description.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Field.Description class={clsx('text-sm text-gray-600', local.class)} {...others} />;
}

export function Control(props: Field.Control.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Field.Control
      class={clsx(
        'h-10 w-full max-w-xs rounded-md bg-[canvas] border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800',
        local.class,
      )}
      {...others}
    />
  );
}

export function Error(props: Field.Error.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Field.Error class={clsx('text-sm text-red-800', local.class)} {...others} />;
}

export function Item(props: Field.Item.Props) {
  return <Field.Item {...props} />;
}
