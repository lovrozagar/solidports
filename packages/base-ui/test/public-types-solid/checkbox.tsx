import type { Checkbox } from '@solidports/base-ui/checkbox';

export type CheckboxProps = Omit<Checkbox.Root.Props, 'children'> & {
  // Add an optional class to mirror the original example's augmentation pattern.
  class?: string;
};
