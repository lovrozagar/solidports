import { createMemo, createSignal, onSettled, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mergeProps } from '../../solid-1-compat';
import type { BaseUIHTMLProps, HTMLProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';

/**
 * @internal
 */
export function LabelableProvider(props: LabelableProvider.Props) {
  const defaultId = useBaseUiId();

  // Solid: `ownedWrite` because controls unregister from their unmount cleanups.
  const [controlIdState, setControlIdState] = createSignal<string | null | undefined>(undefined, {
    ownedWrite: true,
  });
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  // Solid: `ownedWrite` because descriptions unregister from their unmount cleanups.
  const [messageSources, setMessageSources] = createSignal<Accessor<string | undefined>[]>([], {
    ownedWrite: true,
  });
  // React's descriptions add their id from an effect when they start describing and remove it on
  // cleanup, so an id keeps its position and a newly present one goes last. Derived here from the
  // registered sources in the same order.
  const messageIds = createMemo<string[]>((previous = []) => {
    const present = messageSources()
      .map((source) => source())
      .filter((id): id is string => Boolean(id));
    const next = previous.filter((id) => present.includes(id));
    for (const id of present) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    return next.length === previous.length && next.every((id, index) => id === previous[index])
      ? previous
      : next;
  });

  const registerMessageId = (source: Accessor<string | undefined>) => {
    onSettled(() => {
      setMessageSources((sources) => [...sources, source]);
      return () => {
        setMessageSources((sources) => sources.filter((item) => item !== source));
      };
    });
  };

  // `undefined` only survives until the first registration. Do not use `??`:
  // `null` deliberately suppresses `htmlFor`.
  const controlId = () => {
    const current = controlIdState();
    return current === undefined ? defaultId() : current;
  };

  const registrationsRef = new Map<symbol, string | null>();

  const { messageIds: parentMessageIds } = useLabelableContext();

  const registerControlId = (source: symbol, nextId: string | null | undefined) => {
    const registrations = registrationsRef;

    if (nextId === undefined) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }

    setControlIdState((prev) => {
      if (registrations.size === 0) {
        // A hidden subtree (React Activity, a re-suspending Suspense) destroys effects but keeps
        // its DOM, so preserve its selected control.
        return prev;
      }

      let nextControlId: string | null | undefined;

      for (const id of registrations.values()) {
        // Keep the current selection while it is still registered, so rapid unmount/remount
        // cycles don't churn it.
        if (id === prev) {
          return prev;
        }

        if (nextControlId === undefined) {
          nextControlId = id;
        }
      }

      return nextControlId;
    });
  };

  const resetControlId = () => {
    if (registrationsRef.size === 0) {
      setControlIdState(undefined);
    }
  };

  const describedBy = (external: unknown) => {
    const ids = typeof external === 'string' && external ? external.split(' ') : [];
    ids.push(...parentMessageIds(), ...messageIds());
    return Array.from(new Set(ids)).join(' ') || undefined;
  };

  // Solid: the merged view keeps `aria-describedby` live as message ids register.
  const getDescriptionProps = (externalProps: HTMLProps | BaseUIHTMLProps) =>
    mergeProps(externalProps, {
      get 'aria-describedby'() {
        return describedBy((externalProps as Record<string, unknown>)['aria-describedby']);
      },
    }) as BaseUIHTMLProps;

  const contextValue: LabelableContext = {
    controlId,
    registerControlId,
    resetControlId,
    labelId,
    setLabelId,
    messageIds,
    registerMessageId,
    getDescriptionProps,
    describedBy,
  };

  return <LabelableContext value={contextValue}>{props.children}</LabelableContext>;
}

export interface LabelableProviderState {}

export interface LabelableProviderProps {
  children?: JSX.Element;
}

export namespace LabelableProvider {
  export type State = LabelableProviderState;
  export type Props = LabelableProviderProps;
}
