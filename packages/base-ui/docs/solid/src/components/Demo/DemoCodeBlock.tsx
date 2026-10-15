import { createMemo, merge } from 'solid-js';
import { place, reactRef } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps, Ref } from 'docs/src/adapters/react';
import { Collapsible } from '@solidports/base-ui/collapsible';
import * as ScrollArea from '../ScrollArea';

interface DemoCodeBlockProps {
  selectedFile: JSX.Element;
  selectedFileLines: number;
  collapsibleOpen: boolean;
  /** How many lines should the code block have to get collapsed instead of rendering fully */
  collapsibleLinesThreshold?: number;
  collapsibleTriggerRef: Ref<HTMLSpanElement>;
  copyButton: JSX.Element;
}
function Root(props: ReactProps<ComponentProps<typeof ScrollArea.Root>>) {
  return (
    <ScrollArea.Root
      {...props}
      class="DemoCodeBlockRoot"
      tabindex={-1}
      onKeyDown={(
        event: KeyboardEvent & {
          currentTarget: Element;
          target: Element;
        },
      ) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          String.fromCharCode(event.keyCode) === 'A' &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.getSelection()?.selectAllChildren(event.currentTarget);
        }
      }}
    />
  );
}
export function DemoCodeBlock(_props: DemoCodeBlockProps) {
  const props = merge(
    {
      collapsibleLinesThreshold: 8,
    },
    _props,
  );
  const _render = createMemo(() => {
    if (props.selectedFileLines < props.collapsibleLinesThreshold) {
      return (
        <Root>
          <ScrollArea.Viewport>
            <div class="DemoSourceBrowser">{place(props.selectedFile)}</div>
          </ScrollArea.Viewport>
          <ScrollArea.Corner />
          <ScrollArea.Scrollbar orientation="vertical" />
          <ScrollArea.Scrollbar orientation="horizontal" />
          {place(props.copyButton)}
        </Root>
      );
    }
    return (
      <div class="DemoCodeBlockCollapsible">
        <Root data-closed={props.collapsibleOpen ? undefined : ''}>
          <Collapsible.Panel
            keepMounted
            hidden={false}
            render={{
              component: ScrollArea.Viewport,
              get 'aria-hidden'() {
                return !props.collapsibleOpen;
              },
              get 'data-closed'() {
                return props.collapsibleOpen ? undefined : '';
              },
              class: 'DemoCodeBlockViewport',
              ...(!props.collapsibleOpen && {
                tabIndex: undefined,
                style: {
                  overflow: undefined,
                },
              }),
            }}
          >
            <div class="DemoSourceBrowser">{place(props.selectedFile)}</div>
          </Collapsible.Panel>

          {props.collapsibleOpen && (
            <>
              <ScrollArea.Corner />
              <ScrollArea.Scrollbar orientation="vertical" />
              <ScrollArea.Scrollbar orientation="horizontal" />
            </>
          )}
          {place(props.copyButton)}

          <Collapsible.Trigger
            class="DemoCollapseButton"
            data-sticky={props.collapsibleOpen ? '' : undefined}
          >
            <span ref={reactRef(props.collapsibleTriggerRef)} class="DemoCollapseButtonVisual">
              {props.collapsibleOpen ? 'Hide code' : 'Show code'}
            </span>
          </Collapsible.Trigger>
        </Root>
      </div>
    );
  });
  return <>{_render()}</>;
}
