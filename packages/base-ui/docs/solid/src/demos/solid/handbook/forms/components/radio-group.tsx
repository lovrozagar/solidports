
import clsx from 'clsx';
import { RadioGroup as BaseRadioGroup } from '@solidports/base-ui/radio-group';

export function RadioGroup<Value>({ className, ...props }: BaseRadioGroup.Props<Value>) {
  return (
    <BaseRadioGroup
      class={clsx(
        'flex w-full flex-row items-start gap-1 text-neutral-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}
