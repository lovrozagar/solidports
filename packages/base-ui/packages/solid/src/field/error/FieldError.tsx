import {
  createTrackedEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTransitionStatus, type TransitionStatus } from '../../utils/useTransitionStatus';
import { FieldRoot } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { mergeProps as solidMergeProps, splitProps } from '../../solid-1-compat';

const stateAttributesMapping: StateAttributesMapping<FieldError.State> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldError(componentProps: FieldError.Props) {
  const [local, elementProps] = splitProps(componentProps, ['id', 'match']);
  const idProp = () => local.id;

  const id = useBaseUiId(idProp);

  const { validityData, state: fieldState, name } = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();

  const { errors } = useFormContext();

  const formError = () => {
    const n = name();
    return n ? errors()[n] : null;
  };

  const rendered = createMemo(() => {
    let isRendered = false;
    if (formError() || local.match === true) {
      isRendered = true;
    } else if (typeof local.match === 'string') {
      isRendered = Boolean(validityData.state[local.match]);
    } else {
      isRendered = validityData.state.valid === false;
    }
    return isRendered;
  });

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(() => rendered());

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const idValue = id();
    if (!rendered() || !idValue) {
      return;
    }

    setMessageIds((v) => v.concat(idValue));

    _c.push(() => {
      setMessageIds((v) => v.filter((item) => item !== idValue));
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  let errorRef = null as HTMLDivElement | null | undefined;
  const [lastRenderedMessage, setLastRenderedMessage] = createSignal<JSX.Element>(null);
  const [lastRenderedMessageKey, setLastRenderedMessageKey] = createSignal<string | null>(null);

  const errorMessage = createMemo(() => {
    return (
      <>
        {formError() ||
          (validityData.errors.length > 1 ? (
            <ul>
              <For each={validityData.errors}>{(message) => <li>{message}</li>}</For>
            </ul>
          ) : (
            <>{validityData.error}</>
          ))}
      </>
    );
  });

  const errorKey = createMemo(() => {
    const err = formError();
    if (err != null) {
      return Array.isArray(err) ? JSON.stringify(err) : err;
    }
    if (validityData.errors.length > 1) {
      return JSON.stringify(validityData.errors);
    }
    return validityData.error;
  });

  createTrackedEffect(() => {
    if (rendered() && errorKey() !== lastRenderedMessageKey()) {
      setLastRenderedMessageKey(errorKey());
      setLastRenderedMessage(errorMessage());
    }
  });

  useOpenChangeComplete({
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
    open: rendered,
    ref: () => errorRef,
  });

  const state: FieldError.State = solidMergeProps(fieldState, {
    get transitionStatus() {
      return transitionStatus();
    },
  });

  const element = useRenderElement('div', componentProps, {
    enabled: mounted,
    props: [
      {
        get id() {
          return id();
        },
        get children() {
          return <>{rendered() ? errorMessage() : lastRenderedMessage()}</>;
        },
      },
      elementProps,
    ],
    ref: (el) => {
      errorRef = el;
    },
    state,
    stateAttributesMapping,
  });

  return <Show when={mounted()}>{element()}</Show>;
}

export interface FieldErrorState extends FieldRoot.State {
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps extends BaseUIComponentProps<'div', FieldError.State> {
  /**
   * Determines whether to show the error message according to the field’s
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: (boolean | keyof ValidityState) | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
