import { createMemo, Loading } from 'solid-js';
import { useSearchParams } from 'docs/src/adapters/next/navigation';
import codes from 'docs/src/error-codes.json';

function ErrorMessageWithArgs() {
  const searchParams = useSearchParams();
  const _useMemo = createMemo(() => {
    const code = searchParams().get('code');
    const msg =
      (code ? (codes as Partial<Record<string, string>>)[code ?? ''] : null) ??
      `Unknown error code: ${code}`;
    const args = searchParams().getAll('args[]');
    let index = 0;
    return msg.replace(/%s/g, () => {
      const replacement = args[index];
      index += 1;
      return replacement === undefined ? '[missing argument]' : replacement;
    });
  });
  return <>{_useMemo()}</>;
}

/**
 * Client component that interpolates arguments in an error message. Must be
 * a client component because it reads the search params.
 */
export default function ErrorDisplay() {
  return (
    <code>
      <Loading fallback="…">
        <ErrorMessageWithArgs />
      </Loading>
    </code>
  );
}
