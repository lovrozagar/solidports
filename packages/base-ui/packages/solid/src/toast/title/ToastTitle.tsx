import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';
import { getRenderContent } from '../utils/useRenderableElement';

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastTitle(componentProps: ToastTitle.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id', 'children']);

  const { id, children, type, setId } = useToastLabelPart(
    () => local.id,
    () => local.children,
    'title',
  );

  const state: ToastTitle.State = {
    get type() {
      return type();
    },
  };

  const content = () => getRenderContent(componentProps.render, children());

  const element = useRenderElement('h2', componentProps, {
    get children() {
      return content();
    },
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    state,
  });

  return useToastLabelElement(element, () => componentProps.render, content, id, setId);
}

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps extends BaseUIComponentProps<'h2', ToastTitle.State> {}

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}
