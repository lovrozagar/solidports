import { createComponent, createMemo, For, getOwner, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isStaticProp, splitComponentProps } from '../../solid-helpers';
import { createLazyTransitionStatus } from '../../utils/createLazyTransitionStatus';
import { runInLazyScope } from '../../utils/runInLazyScope';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTransitionStatus } from '../../utils/useTransitionStatus';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { FieldRoot } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const stateAttributesMapping: StateAttributesMapping<FieldError.State> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const NATIVE_STATIC_KEYS = ['match'] as const;
const OWN_KEYS: ReadonlySet<string> = new Set(['id', 'match']);
const writeErrorState = compileStateWriter(
  ['disabled', 'touched', 'dirty', 'valid', 'filled', 'focused', 'transitionStatus'],
  stateAttributesMapping,
);

function writeErrorAttributes(w: SetAttribute, id: Accessor<string | undefined>) {
  w.set('id', id());
}

type FieldRootContextValue = ReturnType<typeof useFieldRootContext>;

/**
 * The message the error shows: the form's error for the field unless a `match` is given, else the
 * field's validation errors. React stores the last rendered message in state during render so the
 * message stays visible while the error transitions out; a memo over its previous value models the
 * same derivation.
 */
function createErrorMessage(
  field: FieldRootContextValue,
  formError: Accessor<string | string[] | null | undefined>,
  hasFormError: () => boolean,
  hasSpecificMatch: () => boolean,
  rendered: Accessor<boolean>,
) {
  const { validityData } = field;
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

  const lastRendered = createMemo(
    (previous: { key: string | null | undefined; message: JSX.Element } | undefined) => {
      const last = previous ?? { key: null, message: null };
      if (rendered() && errorKey() !== last.key) {
        return { key: errorKey(), message: errorMessage() };
      }
      return last;
    },
  );

  return () => (rendered() ? errorMessage() : lastRendered().message);
}

/**
 * The native fast path (`context/architecture/render-pipeline.md`): a valid field's error builds no
 * message, element or transition machinery (`createLazyTransitionStatus`); once mounted it renders
 * a plain `<div>` with no props view (D32).
 */
function NativeFieldError(props: FieldError.Props): JSX.Element {
  const id = useBaseUiId(
    isStaticProp(props, 'id') ? untrack(() => props.id) : () => props.id,
  );
  const field = useFieldRootContext(false);
  const { validityData, state: fieldState, name } = field;
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
  const hasSpecificMatch = () => typeof props.match === 'string';

  const rendered = createMemo(() => {
    const match = props.match;
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

  let errorRef = null as HTMLDivElement | null;
  const transition = createLazyTransitionStatus(rendered, {
    closeComplete: { ref: () => errorRef },
  });

  registerMessageId(() => (rendered() ? id() : undefined));

  const state: FieldError.State = solidMergeProps(fieldState, {
    get transitionStatus() {
      return transition.transitionStatus();
    },
  });

  const build = () =>
    untrack(() => {
      const message = createErrorMessage(field, formError, hasFormError, hasSpecificMatch, rendered);
      return renderNativeElement(DIV, props, {
        own: OWN_KEYS,
        state,
        stateWriter: writeErrorState,
        mapping: stateAttributesMapping,
        attributes: writeErrorAttributes,
        handlerTarget: id,
        reactive: true,
        refs: [
          (el: HTMLDivElement | null) => {
            errorRef = el;
          },
        ],
        // The consumer's children replace the message, as in the slow path's props merge.
        children: 'children' in props ? undefined : () => <>{message()}</>,
      }) as unknown as JSX.Element;
    });

  // The element is built once, as the slow path's (GOTCHA-020): a sibling error that appears
  // re-reads this branch, and a rebuilt element would clear the close-complete ref. An error mounted at creation (which
  // the server may have rendered) builds under this part, so hydration claims it; one that mounts
  // later builds in a lazy scope of this part, which the branch's re-runs do not dispose.
  const owner = getOwner();
  let element: JSX.Element | undefined = untrack(() => transition.mounted()) ? build() : undefined;

  return createComponent(Show, {
    get when() {
      return transition.mounted();
    },
    children: () => {
      element ??= runInLazyScope(owner, build);
      return element;
    },
  });
}

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldError(componentProps: FieldError.Props): JSX.Element {
  if (canRenderNative(componentProps, NATIVE_STATIC_KEYS, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return NativeFieldError(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, ['id', 'match']);
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
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
