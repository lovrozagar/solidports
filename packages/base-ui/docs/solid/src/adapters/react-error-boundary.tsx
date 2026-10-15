// `react-error-boundary` for the Solid docs, on Solid's `<Errored>`.
import { Errored, createComponent } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface FallbackProps {
  error: unknown;
  resetErrorBoundary: (...args: unknown[]) => void;
}

export interface ErrorBoundaryProps {
  children?: JSX.Element;
  fallback?: JSX.Element;
  FallbackComponent?: Component<FallbackProps>;
  fallbackRender?: (props: FallbackProps) => JSX.Element;
  onError?: (error: unknown) => void;
  onReset?: () => void;
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <Errored
      fallback={(error, reset) => {
        const value = typeof error === 'function' ? error() : error;
        props.onError?.(value);
        const fallbackProps: FallbackProps = {
          error: value,
          resetErrorBoundary: () => {
            props.onReset?.();
            reset();
          },
        };
        if (props.FallbackComponent) {
          return createComponent(props.FallbackComponent, fallbackProps);
        }
        if (props.fallbackRender) {
          return props.fallbackRender(fallbackProps);
        }
        return props.fallback;
      }}
    >
      {props.children}
    </Errored>
  );
}
