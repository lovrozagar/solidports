import { omit } from 'solid-js';
import type { Ref } from 'solid-js';
import clsx from 'clsx';
import { Field } from '@solidports/base-ui/field';

export function Root(props: Field.Root.Props) {
  const rest = omit(props, 'class');
  return <Field.Root class={clsx('flex flex-col items-start gap-1', props.class)} {...rest} />;
}
export function Label(props: Field.Label.Props) {
  const rest = omit(props, 'class');
  return (
    <Field.Label
      class={clsx(
        'text-sm font-bold text-neutral-950 has-[[role="checkbox"]]:flex has-[[role="checkbox"]]:items-center has-[[role="checkbox"]]:gap-2 has-[[role="checkbox"]]:font-normal has-[[role="radio"]]:flex has-[[role="radio"]]:items-center has-[[role="radio"]]:gap-2 has-[[role="radio"]]:font-normal has-[[role="switch"]]:flex has-[[role="switch"]]:items-center dark:text-white',
        props.class,
      )}
      {...rest}
    />
  );
}
export function Description(props: Field.Description.Props) {
  const rest = omit(props, 'class');
  return (
    <Field.Description
      class={clsx('text-sm text-neutral-600 dark:text-neutral-400', props.class)}
      {...rest}
    />
  );
}
export const Control = function FieldControl(
  props: Field.Control.Props & {
    ref?: Ref<HTMLInputElement>;
  },
) {
  const rest = omit(props, 'class', 'ref');
  return (
    <Field.Control
      ref={props.ref}
      class={clsx(
        'h-8 w-full max-w-xs border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
        props.class,
      )}
      {...rest}
    />
  );
};
export function Error(props: Field.Error.Props) {
  const rest = omit(props, 'class');
  return (
    <Field.Error class={clsx('text-sm text-red-700 dark:text-red-400', props.class)} {...rest} />
  );
}
export function Item(props: Field.Item.Props) {
  return <Field.Item {...props} />;
}
