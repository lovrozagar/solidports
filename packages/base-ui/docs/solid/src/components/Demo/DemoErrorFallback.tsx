import type { FallbackProps } from 'docs/src/adapters/react-error-boundary';

export function DemoErrorFallback(props: FallbackProps) {
  return (
    <div role="alert">
      <p>There was an error while rendering the demo.</p>
      <pre>{(props.error instanceof Error ? props.error.message : null) ?? 'Unknown error'}</pre>
      <button type="button" onClick={(event) => props.resetErrorBoundary?.(event)}>
        Try again
      </button>
    </div>
  );
}
