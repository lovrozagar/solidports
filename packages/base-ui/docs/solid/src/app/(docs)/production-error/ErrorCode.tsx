import { Loading } from 'solid-js';
import { useSearchParams } from 'docs/src/adapters/next/navigation';

export interface ErrorDisplayProps {
  msg: string;
}
function ErrorCodeContent() {
  const _useSearchParams = useSearchParams();
  return <>{_useSearchParams().get('code') ?? ''}</>;
}

/**
 * Client component that interpolates arguments in an error message. Must be
 * a client component because it reads the search params.
 */
export default function ErrorCode() {
  return (
    <Loading fallback="…">
      <ErrorCodeContent />
    </Loading>
  );
}
