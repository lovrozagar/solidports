import { omit } from 'solid-js';
import { reactRef } from 'docs/src/adapters/react';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { observeScrollableInner } from '../utils/observeScrollableInner';

export function Root(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'class', 'children');
  return (
    <div class={clsx('TableRoot', props.class)} {...rest}>
      <table class="TableRootTable">{props.children}</table>
    </div>
  );
}
export function Head(props: ReactProps<ComponentProps<'thead'>>) {
  return <thead {...props} class={clsx('TableHead', props.class)} />;
}
export function Body(props: ReactProps<ComponentProps<'tbody'>>) {
  return <tbody {...props} class={clsx('TableBody', props.class)} />;
}
export function Row(props: ReactProps<ComponentProps<'tr'>>) {
  return <tr {...props} class={clsx('TableRow', props.class)} />;
}
export function ColumnHeader(props: Omit<ReactProps<ComponentProps<'th'>>, 'scope'>) {
  const rest = omit(props, 'children', 'class');
  return (
    <th scope="col" class={clsx('TableColumnHeader', props.class)} {...rest}>
      <div class="TableCellInner">{props.children}</div>
    </th>
  );
}
export function RowHeader(props: Omit<ReactProps<ComponentProps<'th'>>, 'scope'>) {
  const rest = omit(props, 'children', 'class');
  return (
    <th
      scope="row"
      ref={reactRef(observeScrollableInner)}
      class={clsx('TableCell', props.class)}
      {...rest}
    >
      <div class="TableCellInner">{props.children}</div>
    </th>
  );
}
export function Cell(props: ReactProps<ComponentProps<'td'>>) {
  const rest = omit(props, 'children', 'class');
  return (
    <td ref={reactRef(observeScrollableInner)} class={clsx('TableCell', props.class)} {...rest}>
      <div class="TableCellInner">{props.children}</div>
    </td>
  );
}
