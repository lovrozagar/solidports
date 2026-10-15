import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';

export function CaretSortIcon(props: ReactProps<ComponentProps<'svg'>>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}
