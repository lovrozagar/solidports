import { place } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import { ErrorBoundary } from 'docs/src/adapters/react-error-boundary';
import kebabCase from 'es-toolkit/compat/kebabCase';
import { DemoErrorFallback } from './DemoErrorFallback';

export type DemoPlaygroundProps = {
  component: JSX.Element;
  variant?: string;
};
export function DemoPlayground(props: DemoPlaygroundProps) {
  return (
    <ErrorBoundary FallbackComponent={DemoErrorFallback}>
      <div class="DemoPlayground">
        <figure
          aria-label="Component demo"
          data-demo={kebabCase(props.variant)}
          class="DemoPlaygroundInner"
        >
          {place(props.component)}
        </figure>
      </div>
    </ErrorBoundary>
  );
}
