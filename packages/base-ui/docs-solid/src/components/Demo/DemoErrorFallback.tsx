export function DemoErrorFallback(props: { error: unknown; reset: () => void }) {
  const message = () =>
    props.error instanceof Error ? props.error.message : "Unknown error"
  return (
    <div role="alert">
      <p>There was an error while rendering the demo.</p>
      <pre>{message()}</pre>
      <button type="button" onClick={() => props.reset()}>
        Try again
      </button>
    </div>
  )
}
