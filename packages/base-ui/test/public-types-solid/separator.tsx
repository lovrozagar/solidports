import type { Separator } from '@solidports/base-ui/separator';

export type SeparatorProps = Omit<Separator.Props, 'children'> & {
  // Add an optional class to mirror the original example's augmentation pattern.
  class?: string;
};
