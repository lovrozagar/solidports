import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';

export function MinusIcon(props: ReactProps<ComponentProps<'svg'>>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      class="Icon"
      {...props}
    >
      <path d="M1.5 8h13" />
    </svg>
  );
}
