
import clsx from 'clsx';
import { CheckboxGroup as BaseCheckboxGroup } from '@solidports/base-ui/checkbox-group';

export function CheckboxGroup({ className, ...props }: BaseCheckboxGroup.Props) {
  return (
    <BaseCheckboxGroup
      class={clsx(
        'flex flex-col items-start gap-1 text-neutral-950 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}
