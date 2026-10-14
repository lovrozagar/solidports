import { describe, expect, it } from 'vitest';
import { printCode, transformReactToSolid } from './react-to-solid.mjs';

/** Prints code through the transform's own printer, so tests compare structure, not formatting. */
function normalize(code) {
  return printCode(code);
}

function expectTransform(input, output) {
  expect(normalize(transformReactToSolid(input))).toBe(normalize(output));
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

  describe('effects', () => {
    it('runs a mount effect once with its cleanup', () => {
      expectTransform(
        `import * as React from 'react';
export function Listener() {
  React.useEffect(() => {
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return null;
}`,
        `import { onCleanup, onSettled } from 'solid-js';
export function Listener() {
  onSettled(() => {
    window.addEventListener('hashchange', check);
    onCleanup(() => window.removeEventListener('hashchange', check));
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
const ThemeContext = createContext('light');
export function Theme(props: { children: JSX.Element }) {
  return <ThemeContext value="dark">{props.children}</ThemeContext>;
}
export function useTheme() {
  return useContext(ThemeContext);
}`,
      );
    });
  });
});
