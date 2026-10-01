
import clsx from 'clsx';
import { Form as BaseForm } from '@solidports/base-ui/form';

export function Form({ className, ...props }: BaseForm.Props) {
  return (
    <BaseForm
      class={clsx('flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]', className)}
      {...props}
    />
  );
}
