import { createEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { EMPTY_OBJECT } from '../../utils/empty';
import { useSelectItemContext } from '../item/SelectItemContext';
import type { SelectItemContext } from '../item/SelectItemContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { SelectRootContext } from '../root/SelectRootContext';

const NO_OWN_KEYS: ReadonlySet<string> = new Set();

interface TextDeps {
  index: number;
  selectedByFocus: boolean;
}

function readTextDeps(text: ItemTextModel): TextDeps {
  return { index: text.item.index(), selectedByFocus: text.item.selectedByFocus() };
}

/** The text element and the refs it fills: one object per item text. */
class ItemTextModel {
  declare readonly item: SelectItemContext;
  declare readonly root: SelectRootContext;
  declare node: HTMLElement | null | undefined;
  declare readonly setRef: (el: HTMLElement | null | undefined) => void;

  constructor(item: SelectItemContext, root: SelectRootContext) {
    this.item = item;
    this.root = root;
    this.node = null;
    this.setRef = (el) => {
      this.node = el;
      item.textRef.current = el;
    };
  }

  apply(deps: TextDeps) {
    const node = this.node;
    if (!node) {
      return;
    }
    untrack(() => {
      if (deps.index === 0) {
        this.root.firstItemTextRef.current = node;
      }
      if (deps.selectedByFocus) {
        this.root.selectedItemTextRef.current = node;
      }
    });
  }
}

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText(componentProps: SelectItemText.Props) {
  const itemContext = useSelectItemContext();
  const rootContext = useSelectRootContext();
  const text = new ItemTextModel(itemContext, rootContext);

  // Solid: refs are applied once, so React's ref callback (keyed on `index`/`selectedByFocus`)
  // re-runs as an effect when either changes.
  createEffect(
    () => readTextDeps(text),
    (deps) => text.apply(deps),
  );

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with the text
  // refs, no props view (D32).
  if (canRenderNative(componentProps)) {
    return NativeSelectItemText(componentProps, text);
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);
  const element = useRenderElement('div', componentProps, {
    props: elementProps,
    ref: text.setRef,
  });

  return element();
}

function NativeSelectItemText(props: SelectItemText.Props, text: ItemTextModel): JSX.Element {
  const el = (<div />) as unknown as HTMLDivElement;
  return renderNativeElement(el, props, {
    own: NO_OWN_KEYS,
    state: EMPTY_OBJECT,
    stateAttributes: false,
    reactive: false,
    refs: [text.setRef],
  }) as unknown as JSX.Element;
}

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemText.State> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
