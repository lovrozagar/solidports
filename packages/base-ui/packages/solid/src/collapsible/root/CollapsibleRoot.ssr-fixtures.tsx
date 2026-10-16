import { createSignal, merge } from 'solid-js';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

// Collapsible renders natively on the server and while hydrating, and falls back to
// `useRenderElement` for some props. The choice must come out the same on both sides, or every
// hydration key after the part shifts: each shape below hydrates with every node claimed.

export default defineSsrFixtures(import.meta.url, {
  nativeClosed: () => (
    <Collapsible.Root>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  nativeOpen: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderProp: () => (
    <Collapsible.Root defaultOpen render={(props) => <section {...props} />}>
      <Collapsible.Trigger render={(props) => <span {...props} />} nativeButton={false}>
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel render={(props) => <article {...props} />}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  reactiveRef: () => {
    // A ref behind a getter (a spread source): not static, unlike a `ref={…}` attribute, which the
    // compiler reads once.
    const [version] = createSignal(0);
    const divRef = {
      get ref() {
        version();
        return (_element: HTMLDivElement | null) => {};
      },
    };
    const buttonRef = {
      get ref() {
        version();
        return (_element: HTMLButtonElement | null) => {};
      },
    };
    return (
      <Collapsible.Root defaultOpen {...divRef}>
        <Collapsible.Trigger {...buttonRef}>Toggle</Collapsible.Trigger>
        <Collapsible.Panel {...divRef}>Content</Collapsible.Panel>
      </Collapsible.Root>
    );
  },
  mergeProxy: () => {
    const [extra] = createSignal(false);
    const rootProps = merge(() => (extra() ? { disabled: true } : {}), { defaultOpen: true });
    const panelProps = merge(() => (extra() ? { keepMounted: true } : {}));
    return (
      <Collapsible.Root {...rootProps}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
      </Collapsible.Root>
    );
  },
  mixedTree: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger render={(props) => <button type="button" {...props} />}>
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
      <Collapsible.Root>
        <Collapsible.Trigger>Nested</Collapsible.Trigger>
        <Collapsible.Panel render={(props) => <div {...props} />}>Nested content</Collapsible.Panel>
      </Collapsible.Root>
    </Collapsible.Root>
  ),
});
