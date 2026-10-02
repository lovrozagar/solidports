import { createSignal, createUniqueId, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useHover,
  useInteractions,
} from '../../src/floating-ui-solid';
import type { Placement } from '../../src/floating-ui-solid/types';
import { getEmptyRootContext } from '../../src/floating-ui-solid/utils/getEmptyRootContext';
import { defaultProps } from '../../src/solid-helpers';

/** @internal */
export function Main() {
  return (
    <>
      <h1 class="mb-8 text-5xl font-bold">Popover</h1>
      <div class="border-slate-400 mb-4 grid h-[20rem] place-items-center rounded border lg:w-[40rem]">
        <Popover
          modal
          bubbles
          render={(props1) => (
            <>
              <h2 id={props1.labelId} class="mb-2 text-2xl font-bold">
                Title
              </h2>
              <p id={props1.descriptionId} class="mb-2">
                Description
              </p>
              <Popover
                modal
                bubbles
                render={(props2) => (
                  <>
                    <h2 id={props2.labelId} class="mb-2 text-2xl font-bold">
                      Title
                    </h2>
                    <p id={props2.descriptionId} class="mb-2">
                      Description
                    </p>
                    <Popover
                      modal
                      bubbles={false}
                      render={(props3) => (
                        <>
                          <h2 id={props3.labelId} class="mb-2 text-2xl font-bold">
                            Title
                          </h2>
                          <p id={props3.descriptionId} class="mb-2">
                            Description
                          </p>
                          <button type="button" onClick={props3.close} class="font-bold">
                            Close
                          </button>
                        </>
                      )}
                    >
                      {(p) => (
                        <button type="button" {...p}>
                          My button
                        </button>
                      )}
                    </Popover>
                    <button type="button" onClick={props2.close} class="font-bold">
                      Close
                    </button>
                  </>
                )}
              >
                {(p) => (
                  <button type="button" {...p}>
                    My button
                  </button>
                )}
              </Popover>
              <button type="button" onClick={props1.close} class="font-bold">
                Close
              </button>
            </>
          )}
        >
          {(p) => (
            <button type="button" {...p}>
              My button
            </button>
          )}
        </Popover>
      </div>
    </>
  );
}
interface Props {
  render: Component<{ close: () => void; labelId: string; descriptionId: string }>;
  placement?: Placement;
  modal?: boolean;
  children?: Component;
  bubbles?: boolean;
  hover?: boolean;
}

/** @internal */
function PopoverComponent(componentProps: Props) {
  const props = defaultProps(componentProps, {
    modal: true,
    bubbles: true,
    hover: false,
  });
  const [open, setOpen] = createSignal(false);

  const nodeId = useFloatingNodeId();
  const { floatingStyles, refs, context } = useFloating({
    get nodeId() {
      return nodeId();
    },
    get open() {
      return open();
    },
    get placement() {
      return props.placement;
    },
    onOpenChange: setOpen,
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const id = createUniqueId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const triggerId = `${id}-trigger`;
  const fallbackContext = getEmptyRootContext();

  const hoverInteraction = useHover({
    get context() {
      return props.hover ? context : fallbackContext;
    },
    props: {
      handleClose: safePolygon({ blockPointerEvents: true }),
    },
  });
  const click = useClick({ context });
  const dismiss = useDismiss({ context, props: { bubbles: props.bubbles } });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hoverInteraction,
    click,
    dismiss,
  ]);

  return (
    <FloatingNode id={nodeId()}>
      <Dynamic
        component={props.children}
        {...getReferenceProps({
          ref: refs.setReference,
          id: triggerId,
          'aria-haspopup': 'dialog',
          'aria-expanded': open() ? 'true' : 'false',
          'aria-controls': open() ? context.floatingId() : undefined,
          'data-open': open() ? '' : undefined,
        } as JSX.HTMLAttributes<Element>)}
      />

      <FloatingPortal>
        <Show when={open()}>
          <FloatingFocusManager context={context} modal={props.modal}>
            <div
              class="border-slate-900/10 rounded border bg-white bg-clip-padding px-4 py-6 shadow-md"
              ref={refs.setFloating}
              style={floatingStyles()}
              id={context.floatingId()}
              role="dialog"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              {...getFloatingProps()}
            >
              <Dynamic
                component={props.render}
                labelId={labelId}
                descriptionId={descriptionId}
                close={() => setOpen(false)}
              />
            </div>
          </FloatingFocusManager>
        </Show>
      </FloatingPortal>
    </FloatingNode>
  );
}

/** @internal */
export function Popover(props: Props) {
  const parentId = useFloatingParentNodeId();

  // This is a root, so we wrap it with the tree
  return (
    <Show when={parentId === null} fallback={<PopoverComponent {...props} />}>
      <FloatingTree>
        <PopoverComponent {...props} />
      </FloatingTree>
    </Show>
  );
}
