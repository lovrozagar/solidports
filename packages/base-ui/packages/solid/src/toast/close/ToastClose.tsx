import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mayBeTruthy, omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import { canRenderNative, partHandler } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { ToastContext } from '../provider/ToastProviderContext';
import { useToastRootContext } from '../root/ToastRootContext';
import type { ToastRootContext } from '../root/ToastRootContext';

const NATIVE_STATIC_KEYS = ['nativeButton', 'disabled'] as const;
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);
const writeCloseState = compileStateWriter(['type'], undefined);

const BUTTON = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '0' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
  create: () => (<button type="button" tabindex="0" />) as unknown as Element,
};

/** The close button's toast, focus and state: one object per close button. */
class ToastCloseModel {
  declare readonly store: ToastContext;
  declare readonly root: ToastRootContext;
  declare readonly expanded: Accessor<boolean>;
  declare readonly hasFocus: Accessor<boolean>;
  declare readonly setHasFocus: Setter<boolean>;

  constructor(store: ToastContext, root: ToastRootContext) {
    this.store = store;
    this.root = root;
    this.expanded = store.useState('expanded');
    [this.hasFocus, this.setHasFocus] = createSignal(false);
  }

  get type() {
    return this.root.toast().type;
  }
}

/** Hidden from assistive technology while the stack is collapsed and the button is unfocused. */
function writeCloseAttributes(w: SetAttribute, model: ToastCloseModel) {
  w.set('aria-hidden', !model.expanded() && !model.hasFocus() ? 'true' : undefined);
}

const closeStateOf = (model: ToastCloseModel): ToastClose.State => ({
  get type() {
    return model.type;
  },
});

const CLOSE_HANDLERS = {
  onClick: partHandler<ToastCloseModel>('onClick', (model) => {
    model.store.closeToast(model.root.toast().id);
  }),
  onFocus: partHandler<ToastCloseModel>('onFocus', (model) => model.setHasFocus(true)),
  onBlur: partHandler<ToastCloseModel>('onBlur', (model) => model.setHasFocus(false)),
};

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastClose(componentProps: ToastClose.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain enabled `<button>` with
  // the close button's attributes and handlers, no props view (D32). A button that may be disabled
  // keeps `useButton` on the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS, true) &&
    // Static once `canRenderNative` passes: plain values, read without tracking anything.
    (componentProps.nativeButton ?? true) === true &&
    !mayBeTruthy(componentProps, 'disabled')
  ) {
    return NativeToastClose(componentProps);
  }

  const elementProps = omitComponentProps(componentProps, ['disabled', 'nativeButton'] as const);
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const store = useToastProviderContext();
  const { toast } = useToastRootContext();
  const expanded = store.useState('expanded');

  const [hasFocus, setHasFocus] = createSignal(false);

  const { buttonSources, buttonRef } = useButton({
    disabled: () => componentProps.disabled,
    native: nativeButton,
  });

  const state: ToastClose.State = {
    get type() {
      return toast().type;
    },
  };

  const element = useRenderElement('button', componentProps, {
    props: [
      ...buttonSources.attributes,
      {
        get 'aria-hidden'() {
          return !expanded() && !hasFocus() ? 'true' : undefined;
        },
        onClick() {
          store.closeToast(toast().id);
        },
        onFocus() {
          setHasFocus(true);
        },
        onBlur() {
          setHasFocus(false);
        },
      },
      elementProps,
      buttonSources.handlers,
    ],
    ref: buttonRef,
    state,
  });

  return element();
}

function NativeToastClose(props: ToastClose.Props): JSX.Element {
  const model = new ToastCloseModel(useToastProviderContext(), useToastRootContext());
  return renderNativeElement(BUTTON, props, {
    own: OWN_KEYS,
    state: closeStateOf,
    stateView: model,
    stateWriter: writeCloseState,
    attributes: writeCloseAttributes,
    handlers: CLOSE_HANDLERS,
    handlerTarget: model,
    reactive: true,
  }) as unknown as JSX.Element;
}

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastClose.State> {}

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props = ToastCloseProps;
}
