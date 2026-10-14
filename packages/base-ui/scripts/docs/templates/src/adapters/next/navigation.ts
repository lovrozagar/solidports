// `next/navigation` for the Solid docs, on the Solid router. The hooks follow the transformed docs'
// convention: what React re-reads on each render is an accessor.
import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useLocation, useNavigate, useParams as useRouterParams } from '@solidjs/router';

export function usePathname(): Accessor<string> {
  const location = useLocation();
  return () => location.pathname;
}

export function useSearchParams(): Accessor<URLSearchParams> {
  const location = useLocation();
  return createMemo(() => new URLSearchParams(location.search));
}

export function useParams<T extends Record<string, string | string[]>>(): Accessor<T> {
  const params = useRouterParams();
  return () => ({ ...params }) as unknown as T;
}

export interface AppRouter {
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}

export function useRouter(): Accessor<AppRouter> {
  const navigate = useNavigate();
  const router: AppRouter = {
    push: (href, options) => navigate(href, { scroll: options?.scroll ?? true }),
    replace: (href, options) => navigate(href, { replace: true, scroll: options?.scroll ?? true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
  return () => router;
}

/** Thrown by `notFound()`: the app router renders the not-found page in place of the route. */
export class NotFoundError extends Error {
  constructor() {
    super('NEXT_NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export function notFound(): never {
  throw new NotFoundError();
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
