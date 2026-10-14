import { describe, expect, it } from 'vitest';
import { printCode, transformReactToSolid } from './react-to-solid.mjs';

/** Prints code through the transform's own printer, so tests compare structure, not formatting. */
function normalize(code) {
  return printCode(code);
}

function expectTransform(input, output, options) {
  expect(normalize(transformReactToSolid(input, options))).toBe(normalize(output));
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
export function Kbd(props: ComponentProps<'kbd'>) {
  return <kbd {...props} />;
}`,
      );
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

    it('removes keys', () => {
      expectTransform(
        `export function Item(props: { id: string }) {
  return <li key={props.id}>{props.id}</li>;
}`,
        `export function Item(props: { id: string }) {
  return <li>{props.id}</li>;
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
  return <NumberField.Root readOnly itemProp="price" />;
}`,
        `export function Fields() {
  return <NumberField.Root readOnly itemprop="price" />;
}`,
        { componentProps: ['readOnly'] },
      );
    });
  });

  describe('render elements', () => {
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
import clsx from 'clsx';
export function Item(props: ComponentProps<'li'>) {
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
  const callbackRef = { current: null as ((open: boolean) => void) | null };
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
  const inputRef = { current: null as HTMLInputElement | null };
  return <input ref={(element) => { inputRef.current = element; }} onClick={() => inputRef.current?.select()} />;
}`,
      );
    });
  });

  describe('reactivity', () => {
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
export function Counter(props: { initial: number }) {
  const [count] = createSignal(untrack(() => props.initial));
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
        `import { createSignal } from 'solid-js';
export function Lazy() {
  const [value] = createSignal((() => compute())());
  return <span>{value()}</span>;
}`,
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
        `import { createSignal } from 'solid-js';
import { Dynamic } from '@solidjs/web';
export function Editor(props: { value: string }) {
  const [module] = createSignal(loadEditor);
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
        `import { element } from 'docs/src/adapters/react';
export function Search() {
  const input = element(() => <Autocomplete.Input />);
  return <Autocomplete.Root>{input}</Autocomplete.Root>;
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
export function useLabel(_params: Accessor<{ prefix: string; name: string }>, _separator?) {
  const _params2 = createMemo(() => {
    const { prefix, name } = _params();
    return { prefix, name };
  });
  const separator = createMemo(() => (_separator?.() === undefined ? ': ' : _separator?.()));
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
interface ButtonProps extends ComponentProps<'button'> {
  tone?: string;
}
interface PanelProps extends JSX.HTMLAttributes<HTMLDivElement> {}`,
      );
    });

    it('maps React types to Solid and DOM types', () => {
      expectTransform(
        `import * as React from 'react';
type Props = React.PropsWithChildren<{ onPress: (event: React.MouseEvent<HTMLButtonElement>) => void }>;
type Setter = React.Dispatch<React.SetStateAction<boolean>>;
type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Box = React.RefObject<HTMLDivElement | null>;`,
        `import type { Component, ParentProps, Setter as SolidSetter } from 'solid-js';
import type { JSX } from '@solidjs/web';
type Props = ParentProps<{ onPress: (event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => void }>;
type Setter = SolidSetter<boolean>;
type Icon = Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
type Box = { current: HTMLDivElement | null };`,
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
        `import { Copy } from 'lucide-solid';`,
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
import type { Ref } from 'solid-js';
export const Input = function Input(props: { class?: string } & { ref?: Ref<HTMLInputElement> }) {
  const rest = omit(props, 'class', 'ref');
  return <input ref={props.ref} class={props.class} {...rest} />;
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

    it('reads a value a JSX expression narrows once, in the expression', () => {
      expectTransform(
        `import * as React from 'react';
export function User() {
  const [user] = React.useState<{ name: string } | null>(null);
  return <p>{user && user.name}</p>;
}`,
        `import { createSignal } from 'solid-js';
export function User() {
  const [user] = createSignal<{ name: string } | null>(null);
  return <p>{(() => {
    const _user = user();
    return _user && _user.name;
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
        `import type { Ref } from 'solid-js';
export const Button = function Button(props: { label: string } & { ref?: Ref<HTMLButtonElement> }) {
  return <button ref={props.ref}>{props.label}</button>;
};`,
      );
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
