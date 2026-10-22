import {
  children as resolveChildren,
  createComponent,
  createEffect,
  getOwner,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useId } from '../../utils/useId';
import { runInLazyScope } from '../../utils/runInLazyScope';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate, SetAttribute } from '../../utils/native/element';
import { useToastRootContext } from '../root/ToastRootContext';
import type { ToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from './isRenderableNode';
import { useRenderableElement } from './useRenderableElement';
import { isStaticProp } from '../../solid-helpers';

/**
 * Shared logic for `Toast.Title` and `Toast.Description`, which only differ by the rendered tag,
 * the fallback content, and which id setter they register with. Resolves the content and returns
 * the pieces each part passes to `useRenderElement` and `useToastLabelElement`.
 */
export function useToastLabelPart(
  idProp: Parameters<typeof useId>[0],
  childrenProp: () => JSX.Element,
  part: 'title' | 'description',
) {
  const { toast, setTitleId, setDescriptionId } = useToastRootContext();

  const setId = part === 'title' ? setTitleId : setDescriptionId;
  const children = resolveChildren(
    () => childrenProp() ?? (part === 'title' ? toast().title : toast().description),
  );

  const id = useId(idProp);

  return { id, children, type: () => toast().type, setId };
}

/**
 * Registers the label's id with the root while the label renders: one effect over the id it
 * renders with (`undefined` while it renders nothing), re-applied only when that changes.
 */
function registerLabelId(
  shouldRender: Accessor<boolean>,
  id: Accessor<string | undefined>,
  setId: Setter<string | undefined>,
) {
  createEffect(
    () => (shouldRender() ? id() : undefined),
    (currentId) => {
      if (currentId === undefined) {
        return undefined;
      }

      setId(currentId);
      return () => {
        setId((existing) => (existing === currentId ? undefined : existing));
      };
    },
  );
}

const LABEL_OWN_KEYS: ReadonlySet<string> = new Set(['id', 'children']);
const writeLabelState = compileStateWriter(['type'], undefined);

/** A native label's toast, id and content: one object per label. */
class ToastLabelModel {
  declare readonly root: ToastRootContext;
  declare readonly id: Accessor<string | undefined>;
  declare readonly content: Accessor<JSX.Element>;

  constructor(
    root: ToastRootContext,
    id: Accessor<string | undefined>,
    content: Accessor<JSX.Element>,
  ) {
    this.root = root;
    this.id = id;
    this.content = content;
  }

  get type() {
    return this.root.toast().type;
  }
}

function writeLabelAttributes(w: SetAttribute, model: ToastLabelModel) {
  w.set('id', model.id());
}

const labelStateOf = (model: ToastLabelModel) => ({
  get type() {
    return model.type;
  },
});

const labelContentOf = (model: ToastLabelModel) => model.content() as JSX.Element;

/**
 * `Toast.Title` and `Toast.Description` on the native fast path (no `render`): the element is
 * rendered only while its content is renderable, with no props view (D32).
 */
export function renderNativeToastLabel(
  props: { id?: unknown; children?: unknown },
  template: NativeElementTemplate,
  part: 'title' | 'description',
): JSX.Element {
  const root = useToastRootContext();
  const { id, children, setId } = useToastLabelPart(
    // A static id needs no memo (`useId`).
    isStaticProp(props, 'id')
      ? (untrack(() => props.id) as string | undefined)
      : () => props.id as string | undefined,
    () => props.children as JSX.Element,
    part,
  );
  // Show memoizes its condition: no memo of our own.
  const shouldRender = () => isRenderableNode(children());
  registerLabelId(shouldRender, id, setId);
  const model = new ToastLabelModel(root, id, children);

  const build = () =>
    untrack(
      () =>
        renderNativeElement(template, props, {
          own: LABEL_OWN_KEYS,
          state: labelStateOf,
          stateView: model,
          stateWriter: writeLabelState,
          attributes: writeLabelAttributes,
          handlerTarget: model,
          reactive: true,
          children: () => labelContentOf(model),
        }) as unknown as JSX.Element,
    );

  // Built once, as the slow path's element (GOTCHA-020): Title and Description are sibling `Show`s,
  // and the other one appearing re-reads this branch. A label rendered at creation (which the
  // server may have rendered) builds under this part, so hydration claims it; one that appears
  // later builds in a lazy scope of this part.
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

/**
 * Mounts the evaluated label element only when it carries renderable content (so a `render` prop's
 * own children count, while a childless styling-only `render` stays conditional), registering the
 * generated id with the root while the part renders.
 */
export function useToastLabelElement(
  element: () => JSX.Element,
  render: Accessor<unknown>,
  content: Accessor<JSX.Element>,
  id: Accessor<string | undefined>,
  setId: Setter<string | undefined>,
): JSX.Element {
  const { rendered, shouldRender } = useRenderableElement(element, render, content);

  registerLabelId(shouldRender, id, setId);

  return createComponent(Show, {
    get when() {
      return shouldRender();
    },
    children: () => rendered() as JSX.Element,
  });
}
