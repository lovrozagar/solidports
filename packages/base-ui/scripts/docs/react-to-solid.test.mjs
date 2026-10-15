import { describe, expect, it } from 'vitest';
import { printCode, transformReactToSolid } from './react-to-solid.mjs';

/** Prints code through the transform's own printer, so tests compare structure, not formatting. */
function normalize(code, filename) {
  return printCode(code, filename);
}

function expectTransform(input, output, options) {
  expect(normalize(transformReactToSolid(input, options), options?.filename)).toBe(
    normalize(output, options?.filename),
  );
}

describe('transformReactToSolid', () => {
  describe('imports', () => {
    it('drops the client directive and the React namespace import', () => {
      expectTransform(
        `'use client';
import * as React from 'react';
export function Kbd(props: React.ComponentProps<'kbd'>) {
  return <kbd {...props} />;
}`,
        `import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
export function Kbd(props: ReactProps<ComponentProps<'kbd'>>) {
  return <kbd {...props} />;
}`,
      );
    });

    it('adds imports after the leading stylesheet imports', () => {
      expectTransform(
        `import './index.css';
import * as React from 'react';
export function Count() {
  const [count] = React.useState(0);
  return <p>{count}</p>;
}`,
        `import './index.css';
import { createSignal } from 'solid-js';
export function Count() {
  const [count] = createSignal(0);
  return <p>{count()}</p>;
}`,
      );
    });

    it('keeps a blank line after the imports', () => {
      const output = transformReactToSolid(`import * as React from 'react';
import { Button } from '@base-ui/react/button';
export function Save(props: React.ComponentProps<'button'>) {
  return <Button {...props} />;
}`);
      expect(output).toMatch(/from '@solidports\/base-ui\/button';\n\nexport function Save/);
    });
  });

  describe('JSX attributes', () => {
    it('renames className and htmlFor', () => {
      expectTransform(
        `export function Label() {
  return <label className="Label" htmlFor="input" />;
}`,
        `export function Label() {
  return <label class="Label" for="input" />;
}`,
      );
    });

    it('remounts a returned element whose key changes, as React does', () => {
      expectTransform(
        `export function Item(props: { id: string }) {
  return <li key={props.id}>{props.id}</li>;
}`,
        `import { For } from 'solid-js';
export function Item(props: { id: string }) {
  return <For each={[props.id]}>{() => <li>{props.id}</li>}</For>;
}`,
      );
    });

    it('turns style keys into CSS property names', () => {
      expectTransform(
        `export function Box() {
  return <div style={{ paddingBottom: 20, overflowY: 'auto' }} />;
}`,
        `export function Box() {
  return <div style={{ 'padding-bottom': '20px', 'overflow-y': 'auto' }} />;
}`,
      );
    });

    it('converts a style it cannot read as written when it is read', () => {
      expectTransform(
        `export function Bar(props: { width: number }) {
  return <div style={{ width: props.width, ...props.style }} />;
}`,
        `import { reactStyle } from 'docs/src/adapters/react';
export function Bar(props: { width: number }) {
  return <div style={reactStyle({ width: props.width, ...props.style })} />;
}`,
      );
    });

    it('renders dangerouslySetInnerHTML as innerHTML', () => {
      expectTransform(
        `export function Html(props: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: props.html }} />;
}`,
        `export function Html(props: { html: string }) {
  return <div innerHTML={props.html} />;
}`,
      );
    });
  });

  describe('event handlers', () => {
    it("marks a component's async event handler for the Solid lint, in linted files", () => {
      const source = `export function Submit(props: { save: () => Promise<void> }) {
  return <Form onSubmit={async () => { await props.save(); }} />;
}`;
      expect(transformReactToSolid(source, { linted: true })).toContain(
        '// eslint-disable-next-line solid/reactivity -- an event handler (eslint-plugin-solid#168)\n',
      );
      expect(transformReactToSolid(source)).not.toContain('eslint-disable');
    });

    it("calls a handler prop an element binds when the event fires, as the prop's value then", () => {
      expectTransform(
        `export function Retry(props: { onRetry: (event: MouseEvent) => void }) {
  return <button onClick={props.onRetry}>Retry</button>;
}`,
        `export function Retry(props: { onRetry: (event: MouseEvent) => void }) {
  return <button onClick={(event) => props.onRetry?.(event)}>Retry</button>;
}`,
      );
    });
  });

  describe('DOM names', () => {
    it('writes attributes and events under their DOM names on elements', () => {
      expectTransform(
        `export function Field() {
  return (
    <div onFocus={track} onBlur={track} onDoubleClick={track}>
      <input tabIndex={0} readOnly autoComplete="off" onChange={track} />
      <input type="checkbox" onChange={track} />
      <svg xmlnsXlink="http://www.w3.org/1999/xlink"><path strokeWidth={2} /></svg>
      <span aria-hidden />
    </div>
  );
}`,
        `export function Field() {
  return (
    <div onFocusIn={track} onFocusOut={track} onDblClick={track}>
      <input tabindex={0} readonly autocomplete="off" onInput={track} />
      <input type="checkbox" onChange={track} />
      <svg xmlns:xlink="http://www.w3.org/1999/xlink"><path stroke-width={2} /></svg>
      <span aria-hidden="true" />
    </div>
  );
}`,
      );
    });

    it('keeps names a component declares and renames the others', () => {
      expectTransform(
        `export function Fields() {
  return (
    <>
      <NumberField.Root readOnly itemProp="price" />
      <Slider.Thumb tabIndex={0} />
      <ScrollArea.Root tabIndex={0} />
    </>
  );
}`,
        `export function Fields() {
  return (
    <>
      <NumberField.Root readOnly itemprop="price" />
      <Slider.Thumb tabIndex={0} />
      <ScrollArea.Root tabindex={0} />
    </>
  );
}`,
        { componentProps: { readOnly: ['NumberFieldRoot'], tabIndex: ['SliderThumb'] } },
      );
    });
  });

  describe('element refs', () => {
    it("gives an element's props spread onto a component React's element ref", () => {
      const output = transformReactToSolid(
        `import * as React from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
export function Button(props: React.ComponentProps<'button'>) {
  return <BaseButton {...props} />;
}
export function Icon(props: React.ComponentProps<'svg'>) {
  return <svg {...props} />;
}`,
        { standalone: true },
      );
      expect(output).toMatch(
        /Button\(props: Omit<ComponentProps<'button'>, 'ref' \| 'style'> & \{\s*ref\?: \(el: HTMLElementTagNameMap\['button'\] \| null\) => void;\s*style\?: JSX\.CSSProperties;\s*\}\)/,
      );
      expect(output).toContain("Icon(props: ComponentProps<'svg'>)");
    });
  });

  describe('props objects', () => {
    it("writes an element props object's attribute names as Solid's", () => {
      expectTransform(
        `import { mergeProps } from '@base-ui/react/merge-props';
import type { useRender } from '@base-ui/react/use-render';
const base: useRender.ElementProps<'button'> = { className: 'Button', tabIndex: 0 };
export const props = mergeProps<'button'>(base, { className: 'Extra', htmlFor: 'x' });
export const other = { className: 'kept' };`,
        `import { mergeProps } from '@solidports/base-ui/merge-props';
import type { useRender } from '@solidports/base-ui/use-render';
const base: useRender.ElementProps<'button'> = { class: 'Button', tabindex: 0 };
export const props = mergeProps<'button'>(base, { class: 'Extra', for: 'x' });
export const other = { className: 'kept' };`,
      );
    });
  });

  describe('props types', () => {
    it("renames a props type's className, not another type's", () => {
      expectTransform(
        `export interface CardProps { className?: string }
export const classOf = (node: { properties: unknown }) =>
  (node.properties as { className?: string }).className;`,
        `export interface CardProps { class?: string }
export const classOf = (node: { properties: unknown }) =>
  (node.properties as { className?: string }).className;`,
      );
    });
  });

  describe('lists', () => {
    it("renders a list callback that computes values from a memo of its body, as React's re-runs", () => {
      const output = transformReactToSolid(`import * as React from 'react';
export function Table(props: { items: string[] }) {
  const [results] = React.useState<Record<string, number>>({});
  return <ul>{props.items.map((item) => {
    const value = results[item];
    return <li>{value}</li>;
  })}</ul>;
}`);
      expect(output).toContain('const _row = createMemo(() => {');
      expect(output).toContain('const value = results()[item];');
      expect(output).toContain('return <>{_row()}</>;');
    });

    it('renders a list of an optional chain with For, reading the list for its third argument', () => {
      expectTransform(
        `export function Crumbs(props: { title?: string }) {
  return <p>{props.title?.split('/').map((part, i, arr) => (
    <span key={i}>{part}{i !== arr.length - 1 && '/'}</span>
  ))}</p>;
}`,
        `import { For } from 'solid-js';
export function Crumbs(props: { title?: string }) {
  return <p><For each={props.title?.split('/')}>{(part, i) => (
    <span>{part}{i() !== (props.title?.split('/') ?? []).length - 1 && '/'}</span>
  )}</For></p>;
}`,
      );
    });

    it('drops the callback parameters only the dropped key read', () => {
      expectTransform(
        `export function highlight(text: string) {
  return text.split(' ').map((part, idx) => <mark key={idx}>{part}</mark>);
}`,
        `export function highlight(text: string) {
  return text.split(' ').map((part) => <mark>{part}</mark>);
}`,
      );
    });
  });

  describe('keys', () => {
    it('remounts an element whose identity key changes, and keeps list keys to For', () => {
      expectTransform(
        `export function Remount(props: { generation: number; items: string[] }) {
  return (
    <div>
      <Panel key={props.generation} />
      {props.items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}`,
        `import { For } from 'solid-js';
export function Remount(props: { generation: number; items: string[] }) {
  return (
    <div>
      <For each={[props.generation]}>{() => <Panel />}</For>
      <For each={props.items}>{(item) => <span>{item}</span>}</For>
    </div>
  );
}`,
      );
    });
  });

  describe('tests', () => {
    it('writes a props signal property that a variable of its name sets as shorthand', () => {
      const output = transformReactToSolid(`export async function test(render, Panel, variants) {
  const { rerender } = await render(<Panel variants={variants} />);
  rerender(<Panel variants={[]} />);
}`);
      expect(output).toMatch(/createSignal\(\{\s*variants\s*\}\)/);
    });

    it('rerenders an element through a props signal, keeping its state', () => {
      const output = transformReactToSolid(`export async function test(render, Counter) {
  const { rerender } = await render(<Counter step={1} label="a" />);
  rerender(<Counter step={2} label="b" />);
}`);
      expect(output).toContain(
        "const [_props, _setProps] = createSignal({\n    step: 1,\n    label: 'a'\n  });",
      );
      expect(output).toContain('await render(element(() => <Counter {..._props()} />));');
      expect(output).toContain("_setProps({\n    step: 2,\n    label: 'b'\n  });");
    });
  });

  describe('comments', () => {
    it("keeps the file's header comments above the imports it adds", () => {
      const output = transformReactToSolid(`// @vitest-environment jsdom
import * as React from 'react';
import { helper } from './helper';
export function Counter() {
  const [count] = React.useState(0);
  return <span>{helper(count)}</span>;
}`);
      expect(output.startsWith('// @vitest-environment jsdom\n')).toBe(true);
    });

    it('maps lint directives to the Solid rules, dropping rules Solid code has no counterpart for', () => {
      expectTransform(
        `export function Head(props: { json: string; label: string }) {
  /* eslint-disable react/no-children-prop */
  return (
    <script
      title={props.label}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: props.json }}
    />
  );
}`,
        `export function Head(props: { json: string; label: string }) {
  return (
    <script
      title={props.label}
      // eslint-disable-next-line solid/no-innerhtml
      innerHTML={props.json}
    />
  );
}`,
      );
    });

    it("drops element lint rules from a render element's directive once it is a render config", () => {
      const output = transformReactToSolid(`import { Tabs } from '@base-ui/react/tabs';
export function Tab(props: { href: string }) {
  return (
    <Tabs.Tab
      // eslint-disable-next-line jsx-a11y/control-has-associated-label
      render={<a href={props.href} />}
      value="a"
    />
  );
}`);
      expect(output).not.toContain('eslint-disable');
    });
  });

  describe('React developer tools', () => {
    it("drops a component's and a context's displayName, with the guard it leaves empty", () => {
      expectTransform(
        `import * as React from 'react';
export const ThemeContext = React.createContext('light');
if (process.env.NODE_ENV !== 'production') {
  ThemeContext.displayName = 'ThemeContext';
}
export function Demo() {
  return null;
}
Demo.displayName = 'Demo';
export const meta = { displayName: '' };
meta.displayName = 'kept';`,
        `import { createContext } from 'solid-js';
export const ThemeContext = createContext(() => 'light');
export function Demo() {
  return null;
}
export const meta = { displayName: '' };
meta.displayName = 'kept';`,
      );
    });
  });

  describe('render elements', () => {
    it("types an intrinsic config's untyped handlers by the element's attributes", () => {
      const output = transformReactToSolid(`export function Item() {
  return <Menu.Item render={<a href="/" onClick={(event) => event.preventDefault()} />} />;
}`);
      expect(output).toMatch(/satisfies \{\s*component: 'a';\s*\} & JSX\.IntrinsicElements\['a'\]/);
    });

    it('makes a config of each element a conditional render can be', () => {
      const output = transformReactToSolid(`export function Item(props: { file: boolean }) {
  return <Menu.Item render={props.file ? <a href="/file" /> : <Link href="/page" />} />;
}`);
      expect(output).toContain("component: 'a'");
      expect(output).toContain('component: Link');
      expect(output).not.toContain('element(');
    });

    it('passes a render element as a render config', () => {
      expectTransform(
        `import * as React from 'react';
export function Trigger(props: { label: string }) {
  return <Menu.Trigger render={<button className="Button" disabled title={props.label} />} />;
}`,
        `export function Trigger(props: { label: string }) {
  return (
    <Menu.Trigger
      render={{
        component: 'button',
        class: 'Button',
        disabled: true,
        get title() {
          return props.label;
        },
      }}
    />
  );
}`,
      );
    });

    it('passes a component and its children', () => {
      expectTransform(
        `export function Item() {
  return <Menu.Item render={<Link href="/a">Docs</Link>} />;
}`,
        `export function Item() {
  return (
    <Menu.Item
      render={{
        component: Link,
        href: '/a',
        get children() {
          return 'Docs';
        },
      }}
    />
  );
}`,
      );
    });
  });

  describe('props', () => {
    it('reads destructured props from props', () => {
      expectTransform(
        `export function Title({ title, level }: { title: string; level: number }) {
  return <h1 data-level={level}>{title}</h1>;
}`,
        `export function Title(props: { title: string; level: number }) {
  return <h1 data-level={props.level}>{props.title}</h1>;
}`,
      );
    });

    it('omits the destructured props from a rest spread', () => {
      expectTransform(
        `import * as React from 'react';
import clsx from 'clsx';
export function Item({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={clsx('Item', className)} {...props} />;
}`,
        `import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
export function Item(props: ReactProps<ComponentProps<'li'>>) {
  const rest = omit(props, 'class');
  return <li class={clsx('Item', props.class)} {...rest} />;
}`,
      );
    });

    it('leaves names in type positions alone', () => {
      expectTransform(
        `import * as React from 'react';
export function Drawer({ open }: { open: boolean }) {
  const callbackRef = React.useRef<((open: boolean) => void) | null>(null);
  return <div data-open={open} />;
}`,
        `export function Drawer(props: { open: boolean }) {
  const callbackRef: { current: ((open: boolean) => void) | null } = { current: null };
  return <div data-open={props.open} />;
}`,
      );
    });

    it('reads a destructured prop with a string key by index', () => {
      expectTransform(
        `export function Badge({ 'data-badge': badge }: { 'data-badge'?: string }) {
  return <span>{badge}</span>;
}`,
        `export function Badge(props: { 'data-badge'?: string }) {
  return <span>{props['data-badge']}</span>;
}`,
      );
    });

    it('merges destructuring defaults', () => {
      expectTransform(
        `export function Badge({ tone = 'info' }: { tone?: string }) {
  return <span data-tone={tone} />;
}`,
        `import { merge } from 'solid-js';
export function Badge(_props: { tone?: string }) {
  const props = merge({ tone: 'info' }, _props);
  return <span data-tone={props.tone} />;
}`,
      );
    });
  });

  describe('state', () => {
    it('turns useState into a signal and its reads into calls', () => {
      expectTransform(
        `import * as React from 'react';
export function Counter() {
  const [count, setCount] = React.useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`,
        `import { createSignal } from 'solid-js';
export function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}`,
      );
    });

    it('turns useMemo into a memo and drops useCallback', () => {
      expectTransform(
        `import * as React from 'react';
export function Total(props: { items: number[] }) {
  const total = React.useMemo(() => props.items.reduce((a, b) => a + b, 0), [props.items]);
  const log = React.useCallback(() => console.log(total), [total]);
  return <span onClick={log}>{total}</span>;
}`,
        `import { createMemo } from 'solid-js';
export function Total(props: { items: number[] }) {
  const total = createMemo(() => props.items.reduce((a, b) => a + b, 0));
  const log = () => console.log(total());
  return <span onClick={log}>{total()}</span>;
}`,
      );
    });

    it('turns refs into objects assigned by callback refs', () => {
      expectTransform(
        `import * as React from 'react';
export function Focus() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return <input ref={inputRef} onClick={() => inputRef.current?.select()} />;
}`,
        `export function Focus() {
  const inputRef: { current: HTMLInputElement | null } = { current: null };
  return <input ref={(element) => { inputRef.current = element; }} onClick={() => inputRef.current?.select()} />;
}`,
      );
    });
  });

  describe('reactivity', () => {
    it('turns a const a local function derives from reactive values into a memo', () => {
      const output = transformReactToSolid(`import * as React from 'react';
export function Status() {
  const [error] = React.useState<string | null>(null);
  function getMessage() {
    return error ? 'Failed' : 'OK';
  }
  const message = getMessage();
  return <p>{message}</p>;
}`);
      expect(output).toContain('const message = createMemo(() => getMessage());');
      expect(output).toContain('<p>{message()}</p>');
    });

    it('turns a derived const into a memo', () => {
      expectTransform(
        `export function Greeting(props: { name: string }) {
  const label = \`Hello, \${props.name}\`;
  return <span title={label}>{label}</span>;
}`,
        `import { createMemo } from 'solid-js';
export function Greeting(props: { name: string }) {
  const label = createMemo(() => \`Hello, \${props.name}\`);
  return <span title={label()}>{label()}</span>;
}`,
      );
    });

    it('keeps a const that reads nothing reactive', () => {
      expectTransform(
        `export function Static() {
  const label = 'Static';
  const onClick = () => console.log(label);
  return <button onClick={onClick}>{label}</button>;
}`,
        `export function Static() {
  const label = 'Static';
  const onClick = () => console.log(label);
  return <button onClick={onClick}>{label}</button>;
}`,
      );
    });

    it('renders control flow after the hooks through a memo', () => {
      expectTransform(
        `import * as React from 'react';
export function Toggle() {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return <button onClick={() => setOpen(true)}>Open</button>;
  }
  return <div>Open</div>;
}`,
        `import { createMemo, createSignal } from 'solid-js';
export function Toggle() {
  const [open, setOpen] = createSignal(false);
  const _render = createMemo(() => {
    if (!open()) {
      return <button onClick={() => setOpen(true)}>Open</button>;
    }
    return <div>Open</div>;
  });
  return <>{_render()}</>;
}`,
      );
    });

    it('renders a returned expression that is not JSX reactively', () => {
      expectTransform(
        `export function Maybe(props: { show: boolean; children: unknown }) {
  return props.show ? props.children : null;
}`,
        `export function Maybe(props: { show: boolean; children: unknown }) {
  return <>{props.show ? props.children : null}</>;
}`,
      );
    });

    it('reads destructured props from props in the body', () => {
      expectTransform(
        `export function Link(props: { href: string; label: string; target?: string }) {
  const { href, label, ...rest } = props;
  return <a href={href} {...rest}>{label}</a>;
}`,
        `import { omit } from 'solid-js';
export function Link(props: { href: string; label: string; target?: string }) {
  const rest = omit(props, 'href', 'label');
  return <a href={props.href} {...rest}>{props.label}</a>;
}`,
      );
    });

    it('destructures a reactive object in one memo', () => {
      expectTransform(
        `import * as React from 'react';
export function Size() {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const { width, height } = size;
  return <span>{width}x{height}</span>;
}`,
        `import { createMemo, createSignal } from 'solid-js';
export function Size() {
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const _size = createMemo(() => {
    const { width, height } = size();
    return { width, height };
  });
  return <span>{_size().width}x{_size().height}</span>;
}`,
      );
    });

    it('reads a value once where the component sets up, explicitly', () => {
      expectTransform(
        `import * as React from 'react';
export function Counter(props: { initial: number }) {
  const [count] = React.useState(props.initial);
  const doubled = count * 2;
  if (!doubled) {
    console.warn('empty');
  }
  return <span>{count}</span>;
}`,
        `import { createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
export function Counter(props: { initial: number }) {
  const [count] = createSignal(() => untrack(() => initialState(props.initial)));
  const doubled = createMemo(() => count() * 2);
  const _render = createMemo(() => {
    if (!doubled()) {
      console.warn('empty');
    }
    return <span>{count()}</span>;
  });
  return <>{_render()}</>;
}`,
      );
    });

    it('runs a lazy state initializer once', () => {
      expectTransform(
        `import * as React from 'react';
export function Lazy() {
  const [value] = React.useState(() => compute());
  return <span>{value}</span>;
}`,
        `import { createSignal, untrack } from 'solid-js';
export function Lazy() {
  const [value] = createSignal(() => untrack(() => compute()));
  return <span>{value()}</span>;
}`,
      );
    });
  });

  describe('parameter names', () => {
    it("names a function's props parameter params when it is not a component's", () => {
      expectTransform(
        `export const headTemplate = (props: { variantName: string }) => {
  return props.variantName === 'Tailwind' ? '<script></script>' : '';
};`,
        `export const headTemplate = (params: { variantName: string }) => {
  return params.variantName === 'Tailwind' ? '<script></script>' : '';
};`,
      );
    });
  });

  describe('environment hooks', () => {
    it('runs the hook an environment picks in an owner of its own, keyed alike on both sides', () => {
      const output = transformReactToSolid(`function useStoreServer() {
  return null;
}
function useStoreBrowser() {
  return window.localStorage.getItem('key');
}
export default typeof window === 'undefined' ? useStoreServer : useStoreBrowser;`);
      expect(output).toContain("import { environmentHook } from 'docs/src/adapters/react';");
      expect(output).toContain('export default environmentHook(useStoreServer, useStoreBrowser);');
    });
  });

  describe('element props', () => {
    it("passes JSX a component's prop takes as an element, which reading it does not render", () => {
      const output = transformReactToSolid(`export function Nav() {
  return <Item icon={<Icon />} render={<a />}>Home</Item>;
}`);
      expect(output).toContain('icon={element(() => <Icon />)}');
      expect(output).not.toContain('render={element(');
    });
  });

  describe('element values', () => {
    it('places an element value in JSX through a call, which scopes its hydration keys', () => {
      const output = transformReactToSolid(`export function Toolbar(props: { wide: boolean }) {
  const actions = props.wide ? <b>Wide</b> : <i>Narrow</i>;
  const help = <i>Help</i>;
  return <div>{actions}{help}<span>{help}</span></div>;
}`);
      expect(output).toContain("import { element, place } from 'docs/src/adapters/react';");
      expect(output).toContain('<div>{actions()}{place(help)}<span>{place(help)}</span></div>');
    });
  });

  describe('module elements', () => {
    it('creates the elements a module declares in each function that renders them', () => {
      expectTransform(
        `const contents = { a: <p>A</p> };
export default function Demo() {
  return <div>{contents.a}</div>;
}`,
        `export default function Demo() {
  const contents = { a: <p>A</p> };
  return <div>{contents.a}</div>;
}`,
        { standalone: true },
      );
    });
  });

  describe('MDX components', () => {
    it('lowers the components of an MDX components map, as the components they are', () => {
      const output = transformReactToSolid(`import * as React from 'react';
import type { MDXComponents } from 'mdx/types';
export const components: MDXComponents = {
  pre: ({ tabIndex, ...props }: React.ComponentProps<'pre'>) => {
    if ('data-precompute' in props) {
      return <figure><code {...props} /></figure>;
    }
    return <pre {...props} />;
  },
};`);
      expect(output).toContain("const rest = omit(props, 'tabIndex');");
      expect(output).toContain('const _render = createMemo(() => {');
    });

    it('reads a badge prop in the memo that renders it', () => {
      const output = transformReactToSolid(`import * as React from 'react';
function Heading({ children, 'data-heading-badge': headingBadge }: { children?: React.ReactNode; 'data-heading-badge'?: string }) {
  const badge = headingBadge ? <b>{headingBadge}</b> : null;
  return <h2>{children}{badge}</h2>;
}`);
      expect(output).toMatch(
        /const badge = createMemo\(\(\) => \{\s*const _value = props\['data-heading-badge'\];/,
      );
    });
  });

  describe('reactive components', () => {
    it('renders a component read from state with Dynamic', () => {
      expectTransform(
        `import * as React from 'react';
export function Editor(props: { value: string }) {
  const [module] = React.useState(loadEditor);
  return <module.CodeEditor value={props.value}></module.CodeEditor>;
}`,
        `import { createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import { Dynamic } from '@solidjs/web';
export function Editor(props: { value: string }) {
  const [module] = createSignal(() => untrack(() => initialState(loadEditor)));
  return <Dynamic component={module().CodeEditor} value={props.value}></Dynamic>;
}`,
      );
    });
  });

  describe('elements', () => {
    it('renders JSX kept in a variable where it is placed', () => {
      expectTransform(
        `export function Search() {
  const input = <Autocomplete.Input />;
  return <Autocomplete.Root>{input}</Autocomplete.Root>;
}`,
        `import { element, place } from 'docs/src/adapters/react';
export function Search() {
  const input = element(() => <Autocomplete.Input />);
  return <Autocomplete.Root>{place(input)}</Autocomplete.Root>;
}`,
      );
    });

    it('keeps mapped JSX in a variable as elements and renders mapped JSX in place', () => {
      expectTransform(
        `export function List(props: { items: string[] }) {
  const items = props.items.map((item) => <li>{item}</li>);
  return <ul>{items}{props.items.map((item) => <li>{item}</li>)}</ul>;
}`,
        `import { element } from 'docs/src/adapters/react';
import { createMemo, For } from 'solid-js';
export function List(props: { items: string[] }) {
  const items = createMemo(() => props.items.map((item) => element(() => <li>{item}</li>)));
  return <ul>{items()}<For each={props.items}>{(item) => <li>{item}</li>}</For></ul>;
}`,
      );
    });

    it('keeps a memoized element to render later', () => {
      expectTransform(
        `import * as React from 'react';
export function Icon(props: { size: number }) {
  const icon = React.useMemo(() => <svg width={props.size} />, [props.size]);
  return <span>{icon}</span>;
}`,
        `import { element } from 'docs/src/adapters/react';
import { createMemo } from 'solid-js';
export function Icon(props: { size: number }) {
  const icon = createMemo(() => element(() => <svg width={props.size} />));
  return <span>{icon()}</span>;
}`,
      );
    });
  });

  describe('corpus hooks', () => {
    it('reads parameters through accessors and returns a memo', () => {
      expectTransform(
        `import * as React from 'react';
export function useDouble(value: number): number {
  const [factor] = React.useState(2);
  return value * factor;
}`,
        `import { createMemo, createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
export function useDouble(value: Accessor<number>): Accessor<number> {
  const [factor] = createSignal(2);
  return createMemo(() => value() * factor());
}`,
      );
    });

    it('passes arguments as accessors and reads the result through a call', () => {
      expectTransform(
        `import { useDouble } from './useDouble';
export function Double(props: { value: number }) {
  const doubled = useDouble(props.value);
  return <span>{doubled}</span>;
}`,
        `import { useDouble } from './useDouble';
export function Double(props: { value: number }) {
  const doubled = useDouble(() => props.value);
  return <span>{doubled()}</span>;
}`,
      );
    });

    it('destructures a hook result in one memo', () => {
      expectTransform(
        `import { useCounter } from './useCounter';
export function Counter() {
  const { count, increment } = useCounter(1);
  return <button onClick={increment}>{count}</button>;
}`,
        `import { createMemo } from 'solid-js';
import { useCounter } from './useCounter';
export function Counter() {
  const _useCounter = useCounter(() => 1);
  const _useCounter2 = createMemo(() => {
    const { count, increment } = _useCounter();
    return { count, increment };
  });
  return <button onClick={_useCounter2().increment}>{_useCounter2().count}</button>;
}`,
      );
    });

    it('reads destructured and defaulted parameters through accessors', () => {
      expectTransform(
        `export function useLabel({ prefix, name }: { prefix: string; name: string }, separator = ': ') {
  return prefix + separator + name;
}`,
        `import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
export function useLabel(_params: Accessor<{ prefix: string; name: string }>, _separator?: Accessor<string | undefined>) {
  const _params2 = createMemo(() => {
    const { prefix, name } = _params();
    return { prefix, name };
  });
  const separator = createMemo(() => {
    const _separator2 = _separator?.();
    return _separator2 === undefined ? ': ' : _separator2;
  });
  return createMemo(() => _params2().prefix + separator() + _params2().name);
}`,
      );
    });

    it('passes the hooks of other packages props-like objects of getters', () => {
      expectTransform(
        `import { useRender } from '@base-ui/react/use-render';
export function Box(props: { render?: unknown }) {
  const element = useRender({ render: props.render });
  return element;
}`,
        `import { useRender } from '@solidports/base-ui/use-render';
export function Box(props: { render?: unknown }) {
  const element = useRender({
    get render() {
      return props.render;
    },
  });
  return <>{element}</>;
}`,
      );
    });
  });

  describe('context values', () => {
    it('reads a context value through its accessor', () => {
      expectTransform(
        `import * as React from 'react';
const ThemeContext = React.createContext<string>('light');
export function Themed() {
  const theme = React.useContext(ThemeContext);
  return <div data-theme={theme} />;
}`,
        `import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
const ThemeContext = createContext<Accessor<string>>(() => 'light');
export function Themed() {
  const theme = useContext(ThemeContext);
  return <div data-theme={theme()} />;
}`,
      );
    });

    it('provides a state value as its accessor', () => {
      expectTransform(
        `import * as React from 'react';
import { ThemeContext } from './ThemeContext';
export function Theme(props: { children: React.ReactNode }) {
  const [theme] = React.useState('dark');
  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;
}`,
        `import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ThemeContext } from './ThemeContext';
export function Theme(props: { children: JSX.Element }) {
  const [theme] = createSignal('dark');
  return <ThemeContext value={theme}>{props.children}</ThemeContext>;
}`,
      );
    });
  });

  describe('async components', () => {
    it('renders an async component when its memo settles', () => {
      expectTransform(
        `export async function Source(props: { url: string }) {
  const code = await load(props.url);
  return <pre>{code}</pre>;
}`,
        `import { createMemo } from 'solid-js';
export function Source(props: { url: string }) {
  const _rendered = createMemo(async () => {
    const code = await load(props.url);
    return () => <pre>{code}</pre>;
  });
  return <>{_rendered()()}</>;
}`,
      );
    });
  });

  describe('effects', () => {
    it('runs a mount effect once and keeps its cleanup', () => {
      expectTransform(
        `import * as React from 'react';
export function Listener() {
  React.useEffect(() => {
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return null;
}`,
        `import { onSettled } from 'solid-js';
export function Listener() {
  onSettled(() => {
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  });
  return null;
}`,
      );
    });

    it('reruns an effect without dependencies when what it reads changes', () => {
      expectTransform(
        `import * as React from 'react';
export function Title(props: { title: string }) {
  React.useEffect(() => {
    document.title = props.title;
  });
  return null;
}`,
        `import { createTrackedEffect } from 'solid-js';
export function Title(props: { title: string }) {
  createTrackedEffect(() => {
    document.title = props.title;
  });
  return null;
}`,
      );
    });

    it("reads a value an effect's deferred callback uses when the effect runs, as React's closure does", () => {
      const output = transformReactToSolid(`import * as React from 'react';
export function Notice(props: { delay: number }) {
  const [message] = React.useState('');
  const [shown, setShown] = React.useState('');
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setShown(message);
    }, props.delay);
    return () => clearTimeout(timeout);
  }, [message, props.delay]);
  return <p>{shown}</p>;
}`);
      expect(output).toMatch(
        /const (_message) = message\(\);\s*const timeout = setTimeout\(\(\) => \{\s*setShown\(\1\);/,
      );
    });

    it('reruns an effect when its dependencies change', () => {
      expectTransform(
        `import * as React from 'react';
export function Title(props: { title: string }) {
  React.useEffect(() => {
    document.title = props.title;
  }, [props.title]);
  return null;
}`,
        `import { createEffect } from 'solid-js';
export function Title(props: { title: string }) {
  createEffect(() => [props.title], () => {
    document.title = props.title;
  });
  return null;
}`,
      );
    });
  });

  describe('lists', () => {
    it('renders a mapped array with For', () => {
      expectTransform(
        `export function List(props: { items: string[] }) {
  return <ul>{props.items.map((item) => <li key={item}>{item}</li>)}</ul>;
}`,
        `import { For } from 'solid-js';
export function List(props: { items: string[] }) {
  return <ul><For each={props.items}>{(item) => <li>{item}</li>}</For></ul>;
}`,
      );
    });
  });

  describe('context', () => {
    it('renders a context provider as the context component', () => {
      expectTransform(
        `import * as React from 'react';
const ThemeContext = React.createContext('light');
export function Theme(props: { children: React.ReactNode }) {
  return <ThemeContext.Provider value="dark">{props.children}</ThemeContext.Provider>;
}
export function useTheme() {
  return React.useContext(ThemeContext);
}`,
        `import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
const ThemeContext = createContext(() => 'light');
export function Theme(props: { children: JSX.Element }) {
  return <ThemeContext value={() => 'dark'}>{props.children}</ThemeContext>;
}
export function useTheme() {
  return useContext(ThemeContext);
}`,
      );
    });
  });

  describe('providers', () => {
    it('leaves a Provider component of another package alone', () => {
      expectTransform(
        `import { Tooltip } from '@base-ui/react/tooltip';
export function Providers(props: { children: unknown }) {
  return <Tooltip.Provider delay={350}>{props.children}</Tooltip.Provider>;
}`,
        `import { Tooltip } from '@solidports/base-ui/tooltip';
export function Providers(props: { children: unknown }) {
  return <Tooltip.Provider delay={350}>{props.children}</Tooltip.Provider>;
}`,
      );
    });
  });

  describe('dynamic tags', () => {
    it('renders a tag that may be a tag name through Dynamic', () => {
      expectTransform(
        `export function Code(props: { pre?: () => null }) {
  const Pre = props.pre ?? 'pre';
  return <Pre class="code">x</Pre>;
}`,
        `import { createMemo } from 'solid-js';
import { Dynamic } from '@solidjs/web';
export function Code(props: { pre?: () => null }) {
  const Pre = createMemo(() => props.pre ?? 'pre');
  return <Dynamic component={Pre()} class="code">x</Dynamic>;
}`,
      );
    });

    it('renders a prop used as a tag with Dynamic', () => {
      expectTransform(
        `export function Box({ tag: Tag = 'span', children }: { tag?: string; children?: unknown }) {
  return <Tag className="Box">{children}</Tag>;
}`,
        `import { merge } from 'solid-js';
import { Dynamic } from '@solidjs/web';
export function Box(_props: { tag?: string; children?: unknown }) {
  const props = merge({ tag: 'span' }, _props);
  return <Dynamic component={props.tag} class="Box">{props.children}</Dynamic>;
}`,
      );
    });
  });

  describe('fragments and types', () => {
    it('renders React.Fragment as a fragment', () => {
      expectTransform(
        `import * as React from 'react';
export function Pair() {
  return <React.Fragment key="a"><span /><span /></React.Fragment>;
}`,
        `export function Pair() {
  return <><span /><span /></>;
}`,
      );
    });

    it('maps React types an interface extends', () => {
      expectTransform(
        `import * as React from 'react';
interface ButtonProps extends React.ComponentProps<'button'> {
  tone?: string;
}
interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}`,
        `import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
interface ButtonProps extends ReactProps<ComponentProps<'button'>> {
  tone?: string;
}
interface PanelProps extends ReactProps<JSX.HTMLAttributes<HTMLDivElement>> {}`,
      );
    });

    it('maps React types to Solid and DOM types', () => {
      expectTransform(
        `import * as React from 'react';
type Props = React.PropsWithChildren<{ onPress: (event: React.MouseEvent<HTMLButtonElement>) => void }>;
type Setter = React.Dispatch<React.SetStateAction<boolean>>;
type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Box = React.RefObject<HTMLDivElement | null>;`,
        `import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ComponentType, ReactProps } from 'docs/src/adapters/react';
type Props = ParentProps<{ onPress: (event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => void }>;
type Setter = (value: boolean | ((prev: boolean) => boolean)) => void;
type Icon = ComponentType<ReactProps<JSX.SvgSVGAttributes<SVGSVGElement>>>;
type Box = { current: HTMLDivElement | null };`,
      );
    });

    it('imports nothing for a type argument the Solid type drops', () => {
      expectTransform(
        `import * as React from 'react';
export interface Props {
  render?: React.ReactElement<React.ComponentPropsWithRef<'button'>>;
}`,
        `import type { JSX } from '@solidjs/web';
export interface Props {
  render?: JSX.Element;
}`,
      );
    });

    it('maps React effect callback and dependency list types to their shapes', () => {
      expectTransform(
        `import * as React from 'react';
type Effect = React.EffectCallback;
type Deps = React.DependencyList;`,
        `type Effect = () => void | (() => void);
type Deps = readonly unknown[];`,
      );
    });
  });

  describe('Base UI utils hooks', () => {
    it('returns the function of useStableCallback', () => {
      expectTransform(
        `import { useStableCallback } from '@base-ui/utils/useStableCallback';
export function Logger() {
  const log = useStableCallback(() => console.log('x'));
  return <button onClick={log} />;
}`,
        `export function Logger() {
  const log = () => console.log('x');
  return <button onClick={log} />;
}`,
      );
    });

    it('runs useIsoLayoutEffect as a client layout effect', () => {
      expectTransform(
        `import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
export function Measure(props: { width: number }) {
  useIsoLayoutEffect(() => {
    document.body.style.width = String(props.width);
  }, [props.width]);
  return null;
}`,
        `import { createLayoutEffect } from 'docs/src/adapters/react';
export function Measure(props: { width: number }) {
  createLayoutEffect(() => [props.width], () => {
    document.body.style.width = String(props.width);
  });
  return null;
}`,
      );
    });
  });

  describe('modules', () => {
    it('imports the Solid package for Base UI', () => {
      expectTransform(
        `import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react';`,
        `import { Menu } from '@solidports/base-ui/menu';
import { Popover } from '@solidports/base-ui';`,
      );
    });

    it('imports the Solid build of icon libraries', () => {
      expectTransform(
        `import { Copy } from 'lucide-react';`,
        `import { Copy } from '@lucide/solid';`,
      );
    });

    it('renders createPortal as a Portal', () => {
      expectTransform(
        `import { createPortal } from 'react-dom';
export function Overlay(props: { container: HTMLElement; children: unknown }) {
  return createPortal(<div class="Overlay">{props.children}</div>, props.container);
}`,
        `import { Portal } from '@solidjs/web';
export function Overlay(props: { container: HTMLElement; children: unknown }) {
  return <Portal mount={props.container}><div class="Overlay">{props.children}</div></Portal>;
}`,
      );
    });

    it('redirects mapped modules by exact name and prefix', () => {
      expectTransform(
        `import { usePathname } from 'next/navigation';
import { useCode } from '@mui/internal-docs-infra/useCode';`,
        `import { usePathname } from 'docs/src/adapters/next/navigation';
import { useCode } from 'docs/src/adapters/docs-infra/useCode';`,
        {
          modules: {
            'next/navigation': 'docs/src/adapters/next/navigation',
            '@mui/internal-docs-infra/*': 'docs/src/adapters/docs-infra/*',
          },
        },
      );
    });
  });

  describe('more React shapes', () => {
    it('reads a forwarded ref from destructured props', () => {
      expectTransform(
        `import * as React from 'react';
export const Input = React.forwardRef<HTMLInputElement, { className?: string }>(function Input({ className, ...props }, forwardedRef) {
  return <input ref={forwardedRef} className={className} {...props} />;
});`,
        `import { omit } from 'solid-js';
import { reactRef } from 'docs/src/adapters/react';
import type { PropsWithoutRef, Ref } from 'docs/src/adapters/react';
export const Input = function Input(
  props: PropsWithoutRef<{ class?: string }> & { ref?: Ref<HTMLInputElement> },
) {
  const rest = omit(props, 'class', 'ref');
  return <input ref={reactRef(props.ref)} class={props.class} {...rest} />;
};`,
      );
    });

    it('calls the index of a mapped list, which For passes as an accessor', () => {
      expectTransform(
        `export function List(props: { items: string[] }) {
  return <ul>{props.items.map((item, index) => <li data-first={index === 0}>{item}</li>)}</ul>;
}`,
        `import { For } from 'solid-js';
export function List(props: { items: string[] }) {
  return <ul><For each={props.items}>{(item, index) => <li data-first={index() === 0}>{item}</li>}</For></ul>;
}`,
      );
    });

    it('renames className reads on the rest of the props', () => {
      expectTransform(
        `export function Box({ id, ...rest }: { id: string; className?: string }) {
  return <div id={id} className={rest.className} />;
}`,
        `import { omit } from 'solid-js';
export function Box(props: { id: string; class?: string }) {
  const rest = omit(props, 'id');
  return <div id={props.id} class={rest.class} />;
}`,
      );
    });

    it('types the overloads of a hook with accessors', () => {
      expectTransform(
        `import * as React from 'react';
export function useInit<T>(init: () => T): { current: T };
export function useInit(init: () => unknown) {
  return React.useRef(init());
}`,
        `import { createMemo, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
export function useInit<T>(init: Accessor<() => T>): Accessor<{ current: T }>;
export function useInit(init: Accessor<() => unknown>) {
  const _useRef = { current: untrack(init)() };
  return createMemo(() => _useRef);
}`,
      );
    });
  });

  describe('narrowing', () => {
    it('reads a value a statement narrows once', () => {
      expectTransform(
        `import * as React from 'react';
export function User() {
  const [user, setUser] = React.useState<{ name: string } | null>(null);
  const greet = () => {
    if (user) {
      console.log(user.name);
    }
  };
  return <button onClick={greet}>Greet</button>;
}`,
        `import { createSignal } from 'solid-js';
export function User() {
  const [user, setUser] = createSignal<{ name: string } | null>(null);
  const greet = () => {
    const _user = user();
    if (_user) {
      console.log(_user.name);
    }
  };
  return <button onClick={greet}>Greet</button>;
}`,
      );
    });

    it('reads a guarded value once into the JSX the render returns', () => {
      const output = transformReactToSolid(
        `import * as React from 'react';
export function Editor(props: { load: () => Promise<{ Editor: () => React.ReactNode }> }) {
  const [module, setModule] = React.useState<{ Editor: () => React.ReactNode } | null>(null);
  React.useEffect(() => {
    props.load().then(setModule);
  }, []);
  if (!module) {
    return null;
  }
  return <module.Editor />;
}`,
      );
      expect(output).toContain('const _module = module();');
      expect(output).toContain('<Dynamic component={_module.Editor} />');
    });

    it("types a React event without a target type as an event on an Element, as React's", () => {
      expectTransform(
        `import * as React from 'react';
export type Handler = (event: React.KeyboardEvent) => void;`,
        `export type Handler = (event: KeyboardEvent & { currentTarget: Element; target: Element }) => void;`,
      );
    });

    it("types React's event handlers as the docs runtime's, and as Solid's in a demo", () => {
      const source = `import * as React from 'react';
export type Props = { onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement> };`;
      expectTransform(
        source,
        `import type { ReactEventHandler } from 'docs/src/adapters/react';
export type Props = { onKeyDown?: ReactEventHandler<HTMLTextAreaElement, KeyboardEvent> };`,
      );
      expectTransform(
        source,
        `import type { JSX } from '@solidjs/web';
export type Props = { onKeyDown?: JSX.EventHandler<HTMLTextAreaElement, KeyboardEvent> };`,
        { standalone: true },
      );
    });

    it("types a hook's value as the value its accessor returns", () => {
      expectTransform(
        `export function useCount() {
  return 1;
}
export function Count(props: { count: ReturnType<typeof useCount> }) {
  return <span>{props.count}</span>;
}`,
        `import { createMemo } from 'solid-js';
export function useCount() {
  return createMemo(() => 1);
}
export function Count(props: { count: ReturnType<ReturnType<typeof useCount>> }) {
  return <span>{props.count}</span>;
}`,
      );
    });

    it("gives React's capture-phase handlers to the element's ref as capture listeners", () => {
      expectTransform(
        `export function Panel(props: { onKey: () => void; inputRef: (el: HTMLInputElement | null) => void }) {
  return <input ref={props.inputRef} onKeyDownCapture={props.onKey} onFocusCapture={props.onKey} />;
}`,
        `import { captureRef } from 'docs/src/adapters/react';
export function Panel(props: { onKey: () => void; inputRef: (el: HTMLInputElement | null) => void }) {
  return <input ref={captureRef(props.inputRef, { keydown: props.onKey, focusin: props.onKey })} />;
}`,
      );
    });

    it("types an optional hook parameter's accessor as returning undefined too", () => {
      const output =
        transformReactToSolid(`export function useCopier(text: string, opts?: { timeout: number }) {
  return opts?.timeout ?? text.length;
}`);
      expect(output).toContain('opts?: Accessor<{');
      expect(output).toMatch(/timeout: number;\s*\} \| undefined>/);
    });

    it('stores a value of a type parameter through an updater', () => {
      const output = transformReactToSolid(`import * as React from 'react';
export function useLoaded<P>(load: () => Promise<P>) {
  const [data, setData] = React.useState<P | undefined>(undefined);
  React.useEffect(() => {
    load().then((result) => setData(result));
  }, [load]);
  return data;
}`);
      expect(output).toContain('setData(() => result)');
    });

    it('types a callback as its useCallback type argument', () => {
      expectTransform(
        `import * as React from 'react';
type Handler = (value: string) => void;
export function useHandler() {
  const handle = React.useCallback<Handler>((value) => console.log(value.length), []);
  return handle;
}`,
        `import { createMemo } from 'solid-js';
type Handler = (value: string) => void;
export function useHandler() {
  const handle: Handler = (value) => console.log(value.length);
  return createMemo(() => handle);
}`,
      );
    });

    it('reads a property a condition narrows once, before the element that reads it', () => {
      const output = transformReactToSolid(`export function code(converted: { source?: string }) {
  const node = converted.source ? <code>{converted.source.length}</code> : null;
  return { node };
}`);
      expect(output).toContain('const _source = converted.source;');
      expect(output).toContain(
        'const node = _source ? element(() => <code>{_source.length}</code>) : null;',
      );
    });

    it('reads a guarded value once into the elements a memo creates', () => {
      const output = transformReactToSolid(
        `import * as React from 'react';
export function useFiles(params: { file: { name?: string } | null }) {
  const { file } = params;
  return React.useMemo(() => {
    if (!file) {
      return [];
    }
    return [<p title={file.name}>{file.name}</p>];
  }, [file]);
}`,
      );
      expect(output).toContain('const _file = _params().file;');
      expect(output).toContain('element(() => <p title={_file.name}>{_file.name}</p>)');
    });

    it('reads a value a guard narrows once, for the statements after it', () => {
      expectTransform(
        `import * as React from 'react';
export function useName() {
  const [user] = React.useState<{ name: string } | null>(null);
  const read = () => {
    if (!user) {
      return '';
    }
    return user.name;
  };
  return read;
}`,
        `import { createMemo, createSignal } from 'solid-js';
export function useName() {
  const [user] = createSignal<{ name: string } | null>(null);
  const read = () => {
    const _user = user();
    if (!_user) {
      return '';
    }
    return _user.name;
  };
  return createMemo(() => read);
}`,
      );
    });

    it('reads a destructured value once, for the closures a guard narrows it for', () => {
      expectTransform(
        `import * as React from 'react';
export function useKeys(params: { code?: Record<string, string> }) {
  const { code } = params;
  React.useEffect(() => {
    if (!code) {
      return;
    }
    setTimeout(() => console.log(Object.keys(code).map((key) => code[key])));
  }, [code]);
}`,
        `import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
export function useKeys(params: Accessor<{ code?: Record<string, string> }>) {
  const _params = createMemo(() => {
    const { code } = params();
    return { code };
  });
  createEffect(
    () => [_params().code],
    () => {
      const _code = _params().code;
      if (!_code) {
        return;
      }
      setTimeout(() => console.log(Object.keys(_code).map((key) => _code[key])));
    },
  );
}`,
      );
    });

    it('reads a setup value once, and the live value in closures after it', () => {
      expectTransform(
        `import * as React from 'react';
export function useFirst(params: { code?: Record<string, string>; name: string }) {
  const { code, name } = params;
  let first: string | undefined;
  if (typeof code?.[name] === 'string') {
    first = code[name];
  }
  const read = () => code?.[name];
  return React.useMemo(() => [first, read], [first]);
}`,
        `import { createMemo, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
export function useFirst(params: Accessor<{ code?: Record<string, string>; name: string }>) {
  const _params = createMemo(() => {
    const { code, name } = params();
    return { code, name };
  });
  let first: string | undefined;
  const _code = untrack(_params).code;
  const _name = untrack(_params).name;
  if (typeof _code?.[_name] === 'string') {
    first = _code[_name];
  }
  const read = () => _params().code?.[_params().name];
  return createMemo(() => [first, read]);
}`,
      );
    });

    it('renders a value a JSX expression tests and then uses with Show, which narrows it', () => {
      expectTransform(
        `import * as React from 'react';
export function User() {
  const [user] = React.useState<{ name: string } | null>(null);
  return <p>{user && user.name}</p>;
}`,
        `import { createSignal, Show } from 'solid-js';
export function User() {
  const [user] = createSignal<{ name: string } | null>(null);
  return <p><Show when={user()}>{(_user) => _user().name}</Show></p>;
}`,
      );
    });

    it('reads a value again where a JSX expression narrows nothing it uses', () => {
      expectTransform(
        `import * as React from 'react';
export function Count() {
  const [count] = React.useState(0);
  const [error] = React.useState<string | null>(null);
  return <p>{count > 0 ? <b>{count}</b> : null}{error && <i>{error}</i>}</p>;
}`,
        `import { createSignal } from 'solid-js';
export function Count() {
  const [count] = createSignal(0);
  const [error] = createSignal<string | null>(null);
  return <p>{count() > 0 ? <b>{count()}</b> : null}{error() && <i>{error()}</i>}</p>;
}`,
      );
    });

    it("keeps reading a value the component's returned JSX tests, which re-renders it", () => {
      const output = transformReactToSolid(`import * as React from 'react';
export function Item(props: { href: string; pathname: string }) {
  const active = props.pathname === props.href;
  return <a href={props.href} data-scroll={!active} {...(active ? { onClick: () => scrollTo(0, 0) } : {})} />;
}`);
      expect(output).not.toMatch(/const _active = active\(\);/);
      expect(output).toContain('data-scroll={!active()}');
    });

    it('reads a value once where a JSX expression narrows it by a comparison', () => {
      expectTransform(
        `import * as React from 'react';
export function User() {
  const [user] = React.useState<{ name: string } | null>(null);
  return <p>{user !== null && user.name}</p>;
}`,
        `import { createSignal } from 'solid-js';
export function User() {
  const [user] = createSignal<{ name: string } | null>(null);
  return <p>{(() => {
    const _user = user();
    return _user !== null && _user.name;
  })()}</p>;
}`,
      );
    });
  });

  describe('Solid Base UI APIs', () => {
    it('reads the toasts of the toast manager through a call', () => {
      expectTransform(
        `import { Toast } from '@base-ui/react/toast';
export function List() {
  const { toasts } = Toast.useToastManager();
  return <ul>{toasts.map((toast) => <li>{toast.title}</li>)}</ul>;
}`,
        `import { For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';
export function List() {
  const _useToastManager = Toast.useToastManager();
  const { toasts } = _useToastManager;
  return <ul><For each={toasts()}>{(toast) => <li>{toast.title}</li>}</For></ul>;
}`,
      );
    });

    it('reads the selected value Combobox.Value passes through a call', () => {
      expectTransform(
        `export function Value() {
  return <Combobox.Value>{(value: string[]) => value.join(', ')}</Combobox.Value>;
}`,
        `import type { Accessor } from 'solid-js';
export function Value() {
  return <Combobox.Value>{(value: Accessor<string[]>) => value().join(', ')}</Combobox.Value>;
}`,
      );
    });

    it('submits a form with a function action as React 19 does', () => {
      expectTransform(
        `export function Subscribe(props: { save: (data: FormData) => void }) {
  return <form action={props.save} />;
}`,
        `export function Subscribe(props: { save: (data: FormData) => void }) {
  return <form onSubmit={(event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    props.save(new FormData(event.currentTarget));
  }} />;
}`,
      );
    });

    it("reads a docs module's alias of a Base UI hook as the Base UI hook", () => {
      const source = `import { useToastManager } from './toast';
export function Notify() {
  const toastManager = useToastManager();
  return <button onClick={() => toastManager.add({ title: 'Saved' })} />;
}`;
      expectTransform(source, source, { baseUiHookAliases: ['useToastManager'] });
    });

    it('creates a TanStack form from a function and reads its fields through calls', () => {
      expectTransform(
        `import { useForm } from '@tanstack/react-form';
export function Signup() {
  const form = useForm({ defaultValues: { name: '' } });
  return (
    <>
      <form.Field name="name">{(field) => <input value={field.state.value} />}</form.Field>
      <form.Field name="name" children={(field) => <input name={field.name} />} />
    </>
  );
}`,
        `import { createForm } from '@tanstack/solid-form';
export function Signup() {
  const form = createForm(() => ({ defaultValues: { name: '' } }));
  return (
    <>
      <form.Field name="name">{(field) => <input value={field().state.value} />}</form.Field>
      <form.Field name="name" children={(field) => <input name={field().name} />} />
    </>
  );
}`,
      );
    });

    it('writes out useTransition in code users copy', () => {
      expectTransform(
        `import * as React from 'react';
export function Search() {
  const [isPending, startTransition] = React.useTransition();
  return <button disabled={isPending} onClick={() => startTransition(async () => {})} />;
}`,
        `import { createSignal } from 'solid-js';
export function Search() {
  const [isPending, _setIsPending] = createSignal(false);
  const startTransition = (callback: () => unknown) => {
    _setIsPending(true);
    Promise.resolve(callback()).finally(() => _setIsPending(false));
  };
  return <button disabled={isPending()} onClick={() => startTransition(async () => {})} />;
}`,
        { standalone: true },
      );
    });
  });

  describe('strings', () => {
    it('parses a .ts module without JSX, where <T> asserts a type', () => {
      expectTransform(
        `export type Slot = React.ReactNode;
export const width = <number>(0 as unknown);`,
        `import type { JSX } from '@solidjs/web';
export type Slot = JSX.Element;
export const width = <number>(0 as unknown);`,
        { filename: 'types.ts' },
      );
    });

    it('keeps the parentheses of a statement that starts with a declaration keyword', () => {
      const output = transformReactToSolid(
        `export function check(type: unknown) {
  (type satisfies unknown);
}`,
        { filename: 'check.ts' },
      );
      expect(output).toContain('(type satisfies unknown);');
    });

    it('rewrites strings, template parts and JSX text but not module specifiers', () => {
      expectTransform(
        `import { Menu } from './react/menu';
export function Link() {
  return <a href="/react/overview" title={\`/react/\${'x'}\`}>Go to /react/</a>;
}`,
        `import { Menu } from './react/menu';
export function Link() {
  return <a href="/solid/overview" title={\`/solid/\${'x'}\`}>Go to /solid/</a>;
}`,
        { rewriteString: (value) => value.replaceAll('/react/', '/solid/') },
      );
    });
  });

  describe('React runtime APIs', () => {
    it('renders Suspense as Loading and StrictMode as a fragment', () => {
      expectTransform(
        `import * as React from 'react';
export function App(props: { children: React.ReactNode }) {
  return <React.StrictMode><React.Suspense fallback={null}>{props.children}</React.Suspense></React.StrictMode>;
}`,
        `import { Loading } from 'solid-js';
import type { JSX } from '@solidjs/web';
export function App(props: { children: JSX.Element }) {
  return <><Loading fallback={null}>{props.children}</Loading></>;
}`,
      );
    });

    it('loads lazy components with Solid lazy', () => {
      expectTransform(
        `import * as React from 'react';
const Dialog = React.lazy(async () => ({ default: (await import('./Dialog')).Dialog }));`,
        `import { lazy } from 'solid-js';
const Dialog = lazy(async () => ({ default: (await import('./Dialog')).Dialog }));`,
      );
    });

    it('reads a forwarded ref from props', () => {
      expectTransform(
        `import * as React from 'react';
export const Button = React.forwardRef<HTMLButtonElement, { label: string }>(function Button(props, forwardedRef) {
  return <button ref={forwardedRef}>{props.label}</button>;
});`,
        `import { omit } from 'solid-js';
import { reactRef } from 'docs/src/adapters/react';
import type { PropsWithoutRef, Ref } from 'docs/src/adapters/react';
export const Button = function Button(
  _props: PropsWithoutRef<{ label: string }> & { ref?: Ref<HTMLButtonElement> },
) {
  const props = omit(_props, 'ref');
  return <button ref={reactRef(_props.ref)}>{props.label}</button>;
};`,
      );
    });

    it('reads the props a forwarded-ref component destructures as props', () => {
      const output = transformReactToSolid(`import * as React from 'react';
export const Button = React.forwardRef<HTMLButtonElement, { label: string; tone?: string }>(function Button(props, forwardedRef) {
  const { label, ...other } = props;
  return <button ref={forwardedRef} {...other}>{label}</button>;
});`);
      expect(output).not.toContain('const { label');
      expect(output).toContain('{props.label}');
    });

    it('reads an external store through an accessor', () => {
      expectTransform(
        `import * as React from 'react';
export function Platform() {
  const isMac = React.useSyncExternalStore(subscribe, () => navigator.platform === 'MacIntel', () => false);
  return <span>{isMac ? 'Cmd' : 'Ctrl'}</span>;
}`,
        `import { useSyncExternalStore } from 'docs/src/adapters/react';
export function Platform() {
  const isMac = useSyncExternalStore(subscribe, () => navigator.platform === 'MacIntel', () => false);
  return <span>{isMac() ? 'Cmd' : 'Ctrl'}</span>;
}`,
      );
    });
  });
});
