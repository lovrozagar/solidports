import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { EMPTY_ARRAY } from '../../utils/empty';
import type { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, Orientation } from '../../utils/types';
import { createKeyedSelector } from '../../utils/createKeyedSelector';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { warn } from '../../utils/warn';
import { AccordionRootContext } from './AccordionRootContext';

const rootStateAttributesMapping = {
  value: () => null,
};
/** The part's own props: never forwarded to the element. */
/** The root's element: a `<div>`; the server renders the same tag. */
const ROOT_DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

const OWN_KEYS: ReadonlySet<string> = new Set([
  'disabled',
  'hiddenUntilFound',
  'keepMounted',
  'loopFocus',
  'onValueChange',
  'multiple',
  'orientation',
  'value',
  'defaultValue',
]);

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionRoot<Value = any>(
  componentProps: AccordionRoot.Props<Value>,
): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX and the root context on one owner, on the client, the server and while hydrating; the item
  // list stays `CompositeList`.
  if (canRenderNative(componentProps, undefined, true)) {
    const root = createAccordionRoot(componentProps);
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return provideNativeContext(AccordionRootContext, root.contextValue, () =>
      createComponent(CompositeList, {
        refs: { elements: root.accordionItemElements },
        get children() {
          return renderNativeElement(ROOT_DIV, componentProps, {
            own: OWN_KEYS,
            state: root.state,
            mapping: rootStateAttributesMapping,
            reactive: true,
          }) as unknown as JSX.Element;
        },
      }),
    );
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'hiddenUntilFound',
    'keepMounted',
    'loopFocus',
    'onValueChange',
    'multiple',
    'orientation',
    'value',
    'defaultValue',
  ]);
  const root = createAccordionRoot(local);

  const element = useRenderElement('div', componentProps, {
    state: root.state,
    props: elementProps,
    stateAttributesMapping: rootStateAttributesMapping,
  });

  return (
    <AccordionRootContext value={root.contextValue}>
      <CompositeList refs={{ elements: root.accordionItemElements }}>{element()}</CompositeList>
    </AccordionRootContext>
  );
}

/** The root's value state and context, shared by both render paths (`local` reads the props). */
function createAccordionRoot<Value>(
  local: Pick<
    AccordionRoot.Props<Value>,
    | 'disabled'
    | 'hiddenUntilFound'
    | 'keepMounted'
    | 'onValueChange'
    | 'multiple'
    | 'orientation'
    | 'value'
    | 'defaultValue'
  >,
) {
  const disabled = () => local.disabled ?? false;
  const multiple = () => local.multiple ?? false;
  const orientation = () => local.orientation ?? 'vertical';

  const defaultValue = () => local.defaultValue ?? (EMPTY_ARRAY as AccordionRoot.Value<Value>);

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({ hiddenUntilFound: local.hiddenUntilFound, keepMounted: local.keepMounted }),
      (deps) => {
        if (deps.hiddenUntilFound && deps.keepMounted === false) {
          warn(
            'The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.',
          );
        }
      },
    );
  }

  const accordionItemElements: (HTMLElement | null | undefined)[] = [];

  const [value, setValue] = useControlled<AccordionRoot.Value<Value>>({
    controlled: () => local.value,
    default: defaultValue,
    name: 'Accordion',
    state: 'value',
  });

  // Solid: a handler reading the latest value is React's stable callback.
  const handleValueChange = (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    details: AccordionRoot.ChangeEventDetails,
  ) => {
    const currentValue = value();
    if (!multiple()) {
      const nextValue = currentValue[0] === newValue ? [] : [newValue];
      local.onValueChange?.(nextValue, details);
      if (details.isCanceled) {
        return;
      }
      setValue(nextValue);
    } else if (nextOpen) {
      const nextOpenValues = currentValue.slice();
      nextOpenValues.push(newValue);
      local.onValueChange?.(nextOpenValues, details);
      if (details.isCanceled) {
        return;
      }
      setValue(nextOpenValues);
    } else {
      const nextOpenValues = currentValue.filter((v) => v !== newValue);
      local.onValueChange?.(nextOpenValues, details);
      if (details.isCanceled) {
        return;
      }
      setValue(nextOpenValues);
    }
  };

  const state: AccordionRoot.State<Value> = {
    get value() {
      return value();
    },
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const contextValue: AccordionRootContext<Value> = {
    disabled,
    handleValueChange,
    hiddenUntilFound: () => local.hiddenUntilFound ?? false,
    // One keyed selector for every item: an item re-reads only its own membership (S4).
    isOpen: createKeyedSelector(value),
    keepMounted: () => local.keepMounted ?? false,
    state,
    value,
  };

  return { accordionItemElements, contextValue, state };
}

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   * Treat it as read-only: it may be a shared frozen array when no value is set.
   */
  value: AccordionValue<Value>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The component orientation.
   *
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This state no longer affects keyboard focus behavior.
   * @deprecated
   */
  orientation: Orientation;
}

export interface AccordionRootProps<Value = any> extends BaseUIComponentProps<
  'div',
  AccordionRoot.State<Value>
> {
  /**
   * The controlled value of the item(s) that should be expanded.
   *
   * To render an uncontrolled accordion, use the `defaultValue` prop instead.
   */
  value?: AccordionValue<Value> | undefined;
  /**
   * The uncontrolled value of the item(s) that should be initially expanded.
   *
   * To render a controlled accordion, use the `value` prop instead.
   */
  defaultValue?: AccordionValue<Value> | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @deprecated
   */
  loopFocus?: boolean | undefined;
  /**
   * Event handler called when an accordion item is expanded or collapsed.
   * Provides the new value as an argument.
   */
  onValueChange?:
    | ((value: AccordionValue<Value>, eventDetails: AccordionRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @default 'vertical'
   * @deprecated
   */
  orientation?: Orientation | undefined;
}

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails =
  BaseUIChangeEventDetails<AccordionRoot.ChangeEventReason>;

export namespace AccordionRoot {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any> = AccordionRootProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}
