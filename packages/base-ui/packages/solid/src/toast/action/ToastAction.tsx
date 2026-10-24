import { children as resolveChildren, createComponent, getOwner, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { makeEventPreventable } from '../../merge-props/mergeProps';
import { canRenderNative, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate, SetAttribute } from '../../utils/native/element';
import { runInLazyScope } from '../../utils/runInLazyScope';
import { isEventHandlerKey } from '../../utils/isEventHandlerKey';
import { isRenderableNode } from '../utils/isRenderableNode';
import type { ToastRootContext } from '../root/ToastRootContext';
import { omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import type { BaseUIComponentProps, BaseUIEvent, NativeButtonProps } from '../../utils/types';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import { getRenderContent, useRenderableElement } from '../utils/useRenderableElement';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastAction(componentProps: ToastAction.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<button>` with
  // `useButton`'s native gates inlined, the toast's `actionProps` above the consumer's props
  // (D32's sweep).
  if (canRenderNative(componentProps, ['nativeButton']) && (componentProps.nativeButton ?? true)) {
    return renderNativeToastAction(componentProps);
  }
  return SlowToastAction(componentProps);
}

function SlowToastAction(componentProps: ToastAction.Props) {
  const elementProps = omitComponentProps(componentProps, ['disabled', 'nativeButton'] as const);
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const { toast } = useToastRootContext();

  const { buttonSources, buttonRef } = useButton({
    disabled: () => componentProps.disabled,
    native: nativeButton,
  });

  const state: ToastAction.State = {
    get type() {
      return toast().type;
    },
  };

  const computedChildren = () => toast().actionProps?.children ?? componentProps.children;
  const content = () => getRenderContent(componentProps.render, computedChildren());

  const element = useRenderElement('button', componentProps, {
    get children() {
      return content();
    },
    props: [
      ...buttonSources.attributes,
      elementProps,
      propsSourceAccessor(() => toast().actionProps),
      buttonSources.handlers,
    ],
    ref: buttonRef,
    state,
  });

  const { rendered, shouldRender } = useRenderableElement(
    element,
    () => componentProps.render,
    content,
  );

  return <Show when={shouldRender()}>{rendered()}</Show>;
}

const BUTTON: NativeElementTemplate = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '0' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- labelled by its children
  create: () => (<button type="button" tabindex="0" />) as unknown as Element,
};
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton', 'children']);
const writeActionState = compileStateWriter(['type'], undefined);
const NO_ACTION_PROPS: Record<string, unknown> = {};

/** A native action: its toast, its content and the target of its handlers and writes. */
class NativeToastActionModel {
  declare private readonly props: ToastAction.Props;
  declare private readonly root: ToastRootContext;
  declare readonly content: Accessor<JSX.Element>;

  constructor(props: ToastAction.Props, root: ToastRootContext, content: Accessor<JSX.Element>) {
    this.props = props;
    this.root = root;
    this.content = content;
  }

  get type() {
    return this.root.toast().type;
  }

  /** `useButton`'s `disabled`: the consumer's prop. */
  disabled(): boolean {
    return Boolean(this.props.disabled);
  }

  actionProps(): Record<string, unknown> {
    return (
      (this.root.toast().actionProps as Record<string, unknown> | undefined) ?? NO_ACTION_PROPS
    );
  }
}

/**
 * One handler key in the slow path's `mergeProps` order: `useButton`'s gate, then the toast's
 * `actionProps` handler, then the consumer's unless the former called `preventBaseUIHandler()`.
 */
function actionHandler(
  key: string,
  gate?: (model: NativeToastActionModel, event: BaseUIEvent<Event>) => boolean,
): Dispatch<NativeToastActionModel> {
  return (record, nativeEvent) => {
    const event = makeEventPreventable(nativeEvent as BaseUIEvent<Event>);
    return untrack(() => {
      const model = record.target;
      if (gate && !gate(model, event)) {
        return undefined;
      }
      const fromAction = readHandler(model.actionProps(), key);
      const result = fromAction ? fromAction(event) : undefined;
      if (event.baseUIHandlerPrevented) {
        return result;
      }
      const consumer = readHandler(record.props, key);
      return consumer ? consumer(event) : result;
    });
  };
}

/** A disabled button cancels the event and runs no handler. */
function preventWhileDisabled(model: NativeToastActionModel, event: Event) {
  if (model.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (model: NativeToastActionModel) => !model.disabled();

/** `useButton`'s native-button keys, always bound: the `actionProps` handler can come later. */
const ACTION_HANDLERS: Readonly<Record<string, Dispatch<NativeToastActionModel>>> = {
  onClick: actionHandler('onClick', preventWhileDisabled),
  onPointerDown: actionHandler('onPointerDown', preventWhileDisabled),
  onMouseDown: actionHandler('onMouseDown', runWhileEnabled),
  onKeyDown: actionHandler('onKeyDown', runWhileEnabled),
  onKeyUp: actionHandler('onKeyUp', runWhileEnabled),
};

function writeActionAttributes(w: SetAttribute, model: NativeToastActionModel) {
  w.set('disabled', model.disabled() ? true : undefined);
}

/**
 * The `actionProps` attributes, above the consumer's. A handler key the table above binds is
 * dispatched there; any other goes to the element as its own listener.
 */
function writeActionOverrides(w: SetAttribute, model: NativeToastActionModel) {
  const actionProps = model.actionProps();
  for (const key in actionProps) {
    if (
      Object.hasOwn(actionProps, key) &&
      key !== 'children' &&
      key !== 'class' &&
      key !== 'style' &&
      !(isEventHandlerKey(key) && key in ACTION_HANDLERS)
    ) {
      w.set(key, actionProps[key]);
    }
  }
}

const actionState = (model: NativeToastActionModel) => model;
const actionContentOf = (model: NativeToastActionModel) => model.content();

/** Renders the action natively, only while its content is renderable, built once. */
function renderNativeToastAction(props: ToastAction.Props): JSX.Element {
  const root = useToastRootContext();
  const content = resolveChildren(
    () => (root.toast().actionProps?.children as JSX.Element | undefined) ?? props.children,
  );
  const model = new NativeToastActionModel(props, root, content);
  const build = () =>
    untrack(
      () =>
        renderNativeElement(BUTTON, props, {
          own: OWN_KEYS,
          state: actionState,
          stateWriter: writeActionState,
          stateView: model,
          reactive: true,
          attributes: writeActionAttributes,
          attributeOverrides: writeActionOverrides,
          handlers: ACTION_HANDLERS,
          handlerTarget: model,
          // The slow path's merge keeps the consumer's style and class over the source's.
          partStyle: () => model.actionProps().style as JSX.CSSProperties | undefined,
          partClass: () => model.actionProps().class as string | undefined,
          children: () => actionContentOf(model),
        }) as unknown as JSX.Element,
    );
  // Show memoizes its condition: no memo of our own. Built once (GOTCHA-020), in a lazy scope of
  // this part when it first appears after creation.
  const shouldRender = () => isRenderableNode(content());
  const owner = getOwner();
  let element: JSX.Element | undefined = untrack(shouldRender) ? build() : undefined;
  return createComponent(Show, {
    get when() {
      return shouldRender();
    },
    children: () => {
      element ??= runInLazyScope(owner, build);
      return element;
    },
  });
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastAction.State> {}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
