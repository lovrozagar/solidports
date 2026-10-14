import { onSettled } from 'solid-js';
import type { ValidComponent } from '@solidjs/web';
import { useRender } from '@solidports/base-ui/use-render';

export type UseRenderRenderProp<State = Record<string, unknown>> = useRender.RenderProp<State>;
export type UseRenderElementProps<ElementType extends ValidComponent> =
  useRender.ElementProps<ElementType>;
export type UseRenderComponentProps<
  ElementType extends ValidComponent,
  State = {},
  RenderFunctionProps = Record<string, unknown>,
> = useRender.ComponentProps<ElementType, State, RenderFunctionProps>;
export type UseRenderParameters<
  State,
  RenderedElementType extends Element,
  Enabled extends boolean | undefined,
> = useRender.Parameters<State, RenderedElementType, Enabled>;
export type UseRenderReturnValue<Enabled extends boolean | undefined> =
  useRender.ReturnValue<Enabled>;

export interface UseRenderHarnessProps {
  state: { expanded: boolean };
  enabled?: boolean;
  render?: useRender.RenderProp<{ expanded: boolean }>;
}

export function UseRenderHarness(props: UseRenderHarnessProps) {
  let button: HTMLButtonElement | null = null;

  const element = useRender({
    defaultTagName: 'button',
    get state() {
      return props.state;
    },
    enabled: () => props.enabled ?? true,
    get render() {
      return (
        props.render ??
        ((renderProps, currentState) => (
          <button
            type="button"
            {...renderProps}
            data-expanded={currentState?.expanded ? '' : undefined}
          />
        ))
      );
    },
    props: {
      type: 'button',
      get 'aria-expanded'() {
        return props.state.expanded;
      },
    },
    ref: (node: HTMLButtonElement | null) => {
      button = node;
    },
  });

  onSettled(() => {
    void button;
  });

  return element;
}

export function DisabledUseRenderExample() {
  const hiddenElement = useRender<{ expanded: boolean }, HTMLDivElement, false>({
    enabled: false,
    defaultTagName: 'div',
  });

  onSettled(() => {
    void hiddenElement;
  });

  return null;
}
