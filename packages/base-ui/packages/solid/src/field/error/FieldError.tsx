import { createMemo, For, Show } from 'solid-js';
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
  const { registerMessageId } = useLabelableContext();

  const { errors } = useFormContext();

  const formError = createMemo(() => {
    const fieldName = name();
    const formErrors = errors();
    return fieldName && Object.hasOwn(formErrors, fieldName) ? formErrors[fieldName] : null;
  });
  const hasFormError = () => {
    const err = formError();
    return !!(Array.isArray(err) ? err.length : err);
  };
  const hasSpecificMatch = () => typeof local.match === 'string';

  const rendered = createMemo(() => {
    const match = local.match;
    if (match === true) {
      return true;
    }
    if (fieldState.disabled) {
      return false;
    }
    if (typeof match === 'string') {
      return Boolean(validityData.state[match]);
    }
    return hasFormError() || validityData.state.valid === false;
  });

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  registerMessageId(() => (rendered() ? id() : undefined));

  let errorRef = null as HTMLDivElement | null | undefined;

  const error = createMemo(() => {
    let nextError: string | string[] | null | undefined = validityData.error;
    if (!hasSpecificMatch() && hasFormError()) {
      nextError = formError();
    } else if (validityData.errors.length > 1) {
      nextError = validityData.errors;
    }
    return nextError;
  });

  const errorMessage = createMemo((): JSX.Element => {
    const err = error();
    if (Array.isArray(err)) {
      return err.length > 1 ? (
        <ul>
          <For each={err}>{(message) => <li>{message}</li>}</For>
        </ul>
      ) : (
        err[0]
      );
    }
    return err;
  });

  const errorKey = () => {
    const err = error();
    return Array.isArray(err) ? JSON.stringify(err) : err;
  };

  // React stores the last rendered message in state during render so the message stays visible
  // while the error transitions out. A memo over its previous value models the same derivation.
  const lastRendered = createMemo(
    (previous: { key: string | null | undefined; message: JSX.Element } | undefined) => {
      const last = previous ?? { key: null, message: null };
      if (rendered() && errorKey() !== last.key) {
        return { key: errorKey(), message: errorMessage() };
      }
      return last;
    },
  );

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
          return <>{rendered() ? errorMessage() : lastRendered().message}</>;
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
