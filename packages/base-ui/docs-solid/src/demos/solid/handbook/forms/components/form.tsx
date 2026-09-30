import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Form as BaseForm } from '@solidports/base-ui/form';

export function Form(props: BaseForm.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <BaseForm
      class={clsx('flex w-full max-w-3xs sm:max-w-[20rem] flex-col gap-5', local.class)}
      {...others}
    />
  );
}
