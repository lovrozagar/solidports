import { omit } from 'solid-js';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import clsx from 'clsx';
import './ScrollArea.css';

export const Root = ScrollArea.Root;
export function Viewport(props: ScrollArea.Viewport.Props) {
  const rest = omit(props, 'class');
  return <ScrollArea.Viewport class={clsx('ScrollAreaViewport', props.class)} {...rest} />;
}
export function Scrollbar(props: ScrollArea.Scrollbar.Props) {
  const rest = omit(props, 'class');
  return (
    <ScrollArea.Scrollbar class={clsx('ScrollAreaScrollbar', props.class)} {...rest}>
      <ScrollArea.Thumb class="ScrollAreaThumb" />
    </ScrollArea.Scrollbar>
  );
}
export function Corner(props: ScrollArea.Corner.Props) {
  const rest = omit(props, 'class');
  return <ScrollArea.Corner class={clsx('ScrollAreaCorner', props.class)} {...rest} />;
}
