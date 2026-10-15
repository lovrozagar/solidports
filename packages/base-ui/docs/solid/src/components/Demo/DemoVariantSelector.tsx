import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import * as Select from 'docs/src/components/Select';

const translations = {
  variants: {
    Default: 'Default',
    System: 'MUI System',
    Css: 'Plain CSS',
    CssModules: 'CSS Modules',
    Tailwind: 'Tailwind v4',
  } as Record<string, string>,
};
export interface DemoVariantSelectorProps extends ReactProps<JSX.HTMLAttributes<HTMLDivElement>> {
  onVariantChange?: () => void;
  variants: string[];
  selectedVariant: string | null;
  selectVariant: (value: string | null | ((prev: string | null) => string | null)) => void;
}
export function DemoVariantSelector(props: DemoVariantSelectorProps) {
  const handleVariantChange = (value: string | null) => {
    props.selectVariant(value);
    props.onVariantChange?.();
  };
  return (
    <Select.Root
      items={translations.variants}
      value={props.selectedVariant}
      onValueChange={handleVariantChange}
    >
      <Select.Trigger aria-label="Styling method" />
      <Select.Popup>
        <For each={props.variants}>
          {(variantName) => (
            <Select.Item value={variantName}>{translations.variants[variantName]}</Select.Item>
          )}
        </For>
      </Select.Popup>
    </Select.Root>
  );
}
