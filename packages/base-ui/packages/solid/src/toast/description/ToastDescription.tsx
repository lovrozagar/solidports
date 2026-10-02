import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';
import { getRenderContent } from '../utils/useRenderableElement';

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastDescription(componentProps: ToastDescription.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id', 'children']);

  const { id, children, type, setId } = useToastLabelPart(
    () => local.id,
    () => local.children,
    'description',
  );

  const state: ToastDescription.State = {
    get type() {
      return type();
    },
  };

  const content = () => getRenderContent(componentProps.render, children());

  const element = useRenderElement('p', componentProps, {
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

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps extends BaseUIComponentProps<'p', ToastDescription.State> {}

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}
