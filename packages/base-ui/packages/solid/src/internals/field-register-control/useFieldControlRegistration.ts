import type { MaybeAccessor, ReactLikeRef } from '../../solid-helpers';

export interface FieldControlRegistration {
  controlRef: ReactLikeRef<any>;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

export interface UseFieldControlRegistrationParameters {
  change?: (value: unknown) => void;
  commit: (value: unknown, revalidate?: boolean) => void | Promise<void>;
  invalid?: MaybeAccessor<boolean | undefined>;
  markedDirtyRef?: ReactLikeRef<boolean>;
  name?: MaybeAccessor<string | undefined>;
  setRegisteredFieldName?: (name: string | undefined) => void;
  registeredFieldIdRef?: ReactLikeRef<string | undefined>;
  setValidityData?: (...args: any[]) => void;
  validityData?: unknown;
}

export function useFieldControlRegistration(_params: UseFieldControlRegistrationParameters) {
  return {
    registerFieldControl() {},
  };
}
