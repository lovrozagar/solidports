import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';

export function PlusIcon(props: ReactProps<ComponentProps<'svg'>>) {
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
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}
