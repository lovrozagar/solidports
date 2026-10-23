import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import type { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { useFloatingTree } from '../../floating-ui-solid';
import type { FloatingTreeType } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { canRenderNative, partHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import {
  compileStateWriter,
  isNativeRender,
  renderNativeElement,
} from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps, UseRenderElementRef } from '../../utils/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';

// eslint-disable-next-line jsx-a11y/anchor-is-valid -- the template: `href` comes from the consumer's props
const ANCHOR = { tag: 'a', create: () => (<a />) as unknown as Element };
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['active', 'closeOnClick']);
const writeLinkState = compileStateWriter(['active'], undefined);

/**
 * A native link: its model, the target of its module-level handlers and attribute write, and its
 * state (`class`/`style` functions and `data-active` read it). One object per link;
 * `useCompositeItem` inlined.
 */
class NativeLinkModel implements NavigationMenuLink.State {
  declare readonly props: NavigationMenuLink.Props;
  declare readonly root: NavigationMenuRootContext;
  declare readonly composite: CompositeRootContext;
  declare readonly tree: FloatingTreeType | null;
  declare readonly nodeId: Accessor<string | undefined> | null | undefined;
  declare readonly index: Accessor<number>;
  declare element: HTMLElement | null;

  constructor(
    props: NavigationMenuLink.Props,
    root: NavigationMenuRootContext,
    composite: CompositeRootContext,
    tree: FloatingTreeType | null,
    nodeId: Accessor<string | undefined> | null | undefined,
    index: Accessor<number>,
  ) {
    this.props = props;
    this.root = root;
    this.composite = composite;
    this.tree = tree;
    this.nodeId = nodeId;
    this.index = index;
    this.element = null;
  }

  get active() {
    return this.props.active ?? false;
  }

  /** `useCompositeItem`'s focus: the composite highlights this link. */
  focus() {
    this.composite.onHighlightedIndexChange(this.index());
  }

  /** `useCompositeItem`'s hover highlight: focus the link when the composite highlights on hover. */
  mouseMove() {
    const el = this.element;
    if (!this.composite.highlightItemOnHover() || !el) {
      return;
    }
    const disabled = el.hasAttribute('disabled') || el.ariaDisabled === 'true';
    if (!this.composite.isHighlighted(this.index()) && !disabled) {
      el.focus();
    }
  }

  blur(event: FocusEvent) {
    const { root } = this;
    const positionerEl = root.positionerElement();
    const popupEl = root.popupElement();
    if (
      positionerEl &&
      popupEl &&
      isOutsideMenuEvent(
        {
          currentTarget: event.currentTarget as HTMLElement | null,
          relatedTarget: event.relatedTarget as HTMLElement | null,
        },
        {
          popupElement: popupEl,
          rootRef: root.rootRef.current,
          tree: this.tree,
          nodeId: this.nodeId?.(),
        },
      )
    ) {
      root.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
    }
  }

  click(event: MouseEvent) {
    if (this.props.closeOnClick ?? false) {
      this.root.setValue(null, createChangeEventDetails(REASONS.linkPress, event));
    }
  }
}

/**
 * A native link's handlers in the slow path's `mergeProps` order (the consumer's, then the link's,
 * then the composite item's), created once.
 */
const LINK_HANDLERS: Readonly<Record<string, Dispatch<NativeLinkModel>>> = {
  onFocus: partHandler<NativeLinkModel, FocusEvent>('onFocus', (link) => link.focus()),
  onMouseMove: partHandler<NativeLinkModel, MouseEvent>('onMouseMove', (link) => link.mouseMove()),
  onBlur: partHandler<NativeLinkModel, FocusEvent>('onBlur', (link, event) => link.blur(event)),
  onClick: partHandler<NativeLinkModel, MouseEvent>('onClick', (link, event) => link.click(event)),
};

/** The link's own attribute below the consumer's: `aria-current` while active. */
function writeLinkAttributes(w: SetAttribute, link: NativeLinkModel) {
  w.set('aria-current', link.active ? 'page' : undefined);
}

const linkState = (link: NativeLinkModel) => link;

function NativeNavigationMenuLink(props: NavigationMenuLink.Props): JSX.Element {
  const root = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();
  const composite = useCompositeRootContext();
  const listItem = createNativeListItem<null>(null);
  const model = new NativeLinkModel(props, root, composite, tree, nodeId, listItem.index);

  return renderNativeElement(ANCHOR, props, {
    own: OWN_KEYS,
    state: linkState,
    stateWriter: writeLinkState,
    stateView: model,
    reactive: true,
    attributes: writeLinkAttributes,
    handlers: LINK_HANDLERS,
    handlerTarget: model,
    refs: [
      listItem.setRef,
      (node: HTMLElement | null) => {
        model.element = node;
      },
    ],
  }) as unknown as JSX.Element;
}

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuLink(componentProps: NavigationMenuLink.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain link renders its `<a>`
  // with direct JSX and registers with the content's composite list; `useCompositeItem` inlined
  // (D32). A static `render` in the tag, config or function form stays native.
  return canRenderNative(componentProps, undefined, true, isNativeRender)
    ? NativeNavigationMenuLink(componentProps)
    : SlowNavigationMenuLink(componentProps);
}

function SlowNavigationMenuLink(componentProps: NavigationMenuLink.Props): JSX.Element {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'active',
    'closeOnClick',
  ]);
  const active = () => local.active ?? false;
  const closeOnClick = () => local.closeOnClick ?? false;

  const { setValue, popupElement, positionerElement, rootRef } = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  const state: NavigationMenuLink.State = {
    get active() {
      return active();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-current'() {
      return active() ? 'page' : undefined;
    },
    onBlur(event) {
      const positionerEl = positionerElement();
      const popupEl = popupElement();
      if (
        positionerEl &&
        popupEl &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement: popupEl, rootRef: rootRef.current, tree, nodeId: nodeId?.() },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
    onClick(event) {
      if (closeOnClick()) {
        setValue(null, createChangeEventDetails(REASONS.linkPress, event));
      }
    },
    tabindex: undefined,
  };

  return (
    <CompositeItem
      tag="a"
      render={renderProps.render}
      class={renderProps.class}
      state={state}
      refs={[componentProps.ref as UseRenderElementRef<HTMLElement>]}
      props={[defaultProps, elementProps]}
    />
  );
}

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkProps extends BaseUIComponentProps<
  'a',
  NavigationMenuLink.State,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props = NavigationMenuLinkProps;
}
