/*
 * The server and the client compile must agree on which props are static: a native part decides
 * its path from the props' shape (`canRenderNative`: a Solid proxy, a static `ref`, a static
 * `render`), and the server render and the hydrating client must take the same path, or they
 * create different owners and hydration keys. This compiles one source with the installed
 * `@solidjs/babel-plugin` for the client (`dom`) and the server (`ssr`), both hydratable, runs
 * both outputs against stub runtimes, and holds each component call's props to the same shape on
 * both sides: per key, a getter or a plain value, and whether the object came from `mergeProps`.
 * A Solid upgrade that breaks the agreement fails here rather than in a production hydration.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

const solidPlugin = createRequire(require.resolve('@solidjs/vite-plugin')).resolve(
  '@solidjs/babel-plugin',
);

/**
 * Each form `canRenderNative` can meet: one component call per case, in this order. The staticKeys
 * native parts pass (`nativeButton`, `parent`, `inputRef`, `handle`) come last, static and dynamic.
 */
const SOURCE = `
let el;
export function cases(props, v, sig, obj, key, a, b, flag) {
  return [
    <Part k1={props.x} k2={obj.a.b} k3={v} k4={sig()} k5={\`t\${v}\`} k6={v ? a : b}
      k7={obj[key]} k8={() => v} k9={[a, b]} k10={{ a }} k11={!v} k12={v + 1} k13={<span />}
      k14={1} />,
    <Part>text</Part>,
    <Part>{v}</Part>,
    <Part>{sig()}</Part>,
    <Part><span /></Part>,
    <Part ref={a} />,
    <Part ref={props.ref} />,
    <Part ref={el} />,
    <Part ref={[a, b]} />,
    <Part ref={(node) => a(node)} />,
    <Part ref={flag() ? a : b} />,
    <Part render={<div />} />,
    <Part render={flag() ? <div /> : undefined} />,
    <Part render={a} />,
    <Part {...props} />,
    <Part {...props} id="x" />,
    <Part id="x" {...props} />,
    <Part nativeButton />,
    <Part nativeButton={false} />,
    <Part nativeButton={flag()} />,
    <Part parent />,
    <Part parent={flag()} />,
    <Part inputRef={a} />,
    <Part inputRef={flag() ? a : b} />,
    <Part handle={obj} />,
    <Part handle={flag() ? obj : undefined} />,
  ];
}
`;

const MERGED = Symbol('merged');
const lookupGetter = (Object.prototype as unknown as { __lookupGetter__(key: string): unknown })
  .__lookupGetter__;

/** A props object's shape: `merge` for a `mergeProps` result, else each key's getter or value. */
function shape(props: Record<string | symbol, unknown>) {
  if (props[MERGED]) {
    return 'merge';
  }
  return Object.fromEntries(
    Object.keys(props).map((key) => [
      key,
      lookupGetter.call(props, key) === undefined ? 'plain' : 'getter',
    ]),
  );
}

/** Compiles SOURCE for one target and returns the shape of each call's props. */
function compiledShapes(generate: 'dom' | 'ssr') {
  const { code } = babel.transformSync(SOURCE, {
    filename: 'compile-agreement.tsx',
    babelrc: false,
    configFile: false,
    plugins: [[solidPlugin, { generate, hydratable: true, moduleName: '@solidjs/web' }]],
    parserOpts: { plugins: ['jsx', 'typescript'] },
  });
  // The runtime the compiled code imports, stubbed: only the props' shape is under test.
  const runtime: Record<string, unknown> = {
    createComponent: (component: (props: object) => unknown, props: object) => component(props),
    mergeProps: (...sources: object[]) => ({ [MERGED]: true, sources }),
    template: () => () => null,
    getNextElement: () => null,
    applyRef: () => {},
    ssr: () => '',
    ssrHydrationKey: () => '',
    escape: (value: unknown) => value,
  };
  const imports: string[] = [];
  const body = code
    .replace(/import \{([^}]*)\} from "@solidjs\/web";\n?/g, (_: string, specifiers: string) => {
      for (const specifier of specifiers.split(',').map((part) => part.trim()).filter(Boolean)) {
        const [name, local = name] = specifier.split(/\s+as\s+/);
        imports.push(`const ${local} = runtime.${name};`);
      }
      return '';
    })
    .replace('export function cases', 'function cases');
  const Part = (props: Record<string | symbol, unknown>) => shape(props);
  // eslint-disable-next-line no-new-func -- runs the compiler's output, the subject under test
  const cases = new Function('runtime', 'Part', `${imports.join('\n')}\n${body}\nreturn cases;`)(
    runtime,
    Part,
  );
  const sig = () => 1;
  return cases({ x: 1, ref: () => {} }, 1, sig, { a: { b: 1 } }, 'a', () => {}, () => {}, sig);
}

describe('the server and the client compile agree on which props are static', () => {
  const dom = compiledShapes('dom');
  const ssr = compiledShapes('ssr');

  it('every component call gets the same props shape on both sides', () => {
    expect(ssr).toEqual(dom);
  });

  it('the shapes are the ones canRenderNative relies on', () => {
    expect(dom).toEqual([
      {
        k1: 'getter',
        k2: 'getter',
        k3: 'plain',
        k4: 'getter',
        k5: 'plain',
        k6: 'plain',
        k7: 'getter',
        k8: 'plain',
        k9: 'plain',
        k10: 'plain',
        k11: 'plain',
        k12: 'plain',
        k13: 'getter',
        k14: 'plain',
      },
      { children: 'plain' },
      { children: 'plain' },
      { children: 'getter' },
      { children: 'getter' },
      // A ref compiles to a plain value or a `ref(el)` method: static on both sides.
      { ref: 'plain' },
      { ref: 'plain' },
      { ref: 'plain' },
      { ref: 'plain' },
      { ref: 'plain' },
      // A conditional ref is no ref at all: both compiles drop it, so a dynamic ref cannot be
      // written in JSX.
      {},
      { render: 'getter' },
      { render: 'getter' },
      { render: 'plain' },
      // A lone spread passes the object itself; with other props, a mergeProps proxy.
      { x: 'plain', ref: 'plain' },
      'merge',
      'merge',
      // A staticKey is static as a literal or an identifier and a getter as a call: a dynamic
      // value takes the slow path on both sides.
      { nativeButton: 'plain' },
      { nativeButton: 'plain' },
      { nativeButton: 'getter' },
      { parent: 'plain' },
      { parent: 'getter' },
      { inputRef: 'plain' },
      { inputRef: 'getter' },
      { handle: 'plain' },
      { handle: 'getter' },
    ]);
  });
});
