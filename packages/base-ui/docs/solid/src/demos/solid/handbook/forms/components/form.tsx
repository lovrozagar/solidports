import { omit } from 'solid-js';

import clsx from 'clsx';
import { Form as BaseForm } from '@solidports/base-ui/form';

export function Form(props: BaseForm.Props) {
  const others = omit(props, 'class');
  return (
    <BaseForm
      class={clsx('flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]', props.class)}
      {...others}
    />
  );
}
