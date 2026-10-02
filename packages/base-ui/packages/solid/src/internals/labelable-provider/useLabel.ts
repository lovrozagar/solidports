import type { Setter } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { getTarget } from '../../floating-ui-solid/utils';
import { access, type MaybeAccessor } from '../../solid-helpers';
import { ownerDocument } from '../../utils/owner';
import type { HTMLProps } from '../../utils/types';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useLabelableContext } from './LabelableContext';

type LabelIdUpdate = string | undefined | ((prev: string | undefined) => string | undefined);

export function useLabel(params: UseLabelParameters = {}): UseLabelReturnValue {
  const native = () => access(params.native) ?? false;

  const { controlId: contextControlId, setLabelId: setContextLabelId } = useLabelableContext();

  function syncLabelId(nextLabelId: LabelIdUpdate) {
    setContextLabelId(nextLabelId);
    params.setLabelId?.(nextLabelId);
  }

  // Solid: `syncLabelId` forwards values and updaters to both setters, as React's Dispatch does.
  const id = useRegisteredLabelId(
    () => access(params.id),
    syncLabelId as Setter<string | undefined>,
  );

  const resolvedControlId = () => contextControlId() ?? access(params.fallbackControlId);

  function focusControl(event: MouseEvent) {
    const controlId = resolvedControlId() ?? undefined;

    if (params.focusControl) {
      params.focusControl(event, controlId);
      return;
    }

    if (!controlId) {
      return;
    }

    const controlElement = ownerDocument(event.currentTarget as Element).getElementById(controlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (target?.closest('button,input,select,textarea')) {
      return;
    }

    // Prevent text selection when double clicking label.
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (native()) {
      return;
    }

    focusControl(event);
  }

  // Solid: one props object with handlers that check `native` stands in for React's two shapes,
  // so the shape follows `native` reactively without remounting.
  return {
    get id() {
      return id();
    },
    get for() {
      return native() ? (resolvedControlId() ?? undefined) : undefined;
    },
    onMouseDown(event: MouseEvent) {
      if (native()) {
        handleInteraction(event);
      }
    },
    onClick(event: MouseEvent) {
      if (!native()) {
        handleInteraction(event);
      }
    },
    onPointerDown(event: PointerEvent) {
      if (!native()) {
        event.preventDefault();
      }
    },
  };
}

export interface UseLabelParameters {
  id?: MaybeAccessor<string | undefined>;
  /**
   * Control id used when no labelable context control id exists.
   */
  fallbackControlId?: MaybeAccessor<string | undefined>;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default false
   */
  native?: MaybeAccessor<boolean | undefined>;
  /**
   * Additional callback to sync the current label id with local component state/store.
   */
  setLabelId?: Setter<string | undefined> | undefined;
  /**
   * Custom focus handler for non-native labels.
   * If omitted, focus behavior targets the resolved control id.
   */
  focusControl?: ((event: MouseEvent, controlId: string | undefined) => void) | undefined;
}

export type UseLabelReturnValue = HTMLProps & { for?: string | undefined };

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true,
  } as FocusOptions);
}
