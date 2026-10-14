/// <reference types="vite/client" />
/*
 * Hydration: every `*.ssr-fixtures.tsx` fixture, server-rendered and hydrated, must leave the
 * server's nodes claimed and its form controls' state as the server rendered it. The harness
 * renders a sentinel after each fixture: a fixture that creates a computation the server did not
 * (or in another order) shifts the keys of everything after it, and the sentinel stays the
 * server's inert copy.
 */
import { flush } from 'solid-js';
import { render as clientRender } from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { flushMicrotasks } from '../flushMicrotasks';
import {
  advanceHydrationSentinel,
  currentHydrationSentinel,
  HYDRATION_SENTINEL,
  SERVER_RENDERS,
} from '../hydrationSentinel';
import type { ServerRender } from '../hydrationSentinel';
import { renderServer } from '../ssrFixtures';
import type { SsrFixtures } from '../ssrFixtures';

/** The form controls in the document. */
function formControls() {
  return [...document.body.querySelectorAll('input, textarea, option')];
}

const FORM_STATE_ATTRIBUTES = ['value', 'checked', 'selected'];

/**
 * The form-state attributes each control carries. Browsers read an input whose value equals its
 * `value` attribute as prefilled by the page (autofill skips it), so hydration must leave the
 * attributes a client render has.
 */
function formStateAttributes(controls: Element[]) {
  return controls.map((control) =>
    FORM_STATE_ATTRIBUTES.filter((name) => control.hasAttribute(name)),
  );
}

/** Each control's live state: what the user sees and submits. */
function formState(controls: Element[]) {
  return controls.map((control) => {
    const element = control as HTMLInputElement & HTMLOptionElement;
    return { value: element.value, checked: element.checked, selected: element.selected };
  });
}

const modules = import.meta.glob<SsrFixtures>('../../src/**/*.ssr-fixtures.tsx', {
  eager: true,
  import: 'default',
});

describe.for(Object.keys(SERVER_RENDERS) as ServerRender[])('hydration (%s)', (render) => {
  for (const module of Object.values(modules)) {
    describe(`${module.file}`, () => {
      for (const name of Object.keys(module.fixtures)) {
        it(`${name}: claims every server node and keeps form state`, async () => {
          const { hydrate, unclaimedNodes } = renderServer(module, name, { render });
          const sentinel = screen.getByTestId('hydration-sentinel');
          expect(sentinel).toHaveAttribute(HYDRATION_SENTINEL, '0');
          const serverControls = formControls();
          const serverFormState = formState(serverControls);

          hydrate();

          expect(unclaimedNodes().map((node) => node.outerHTML)).toEqual([]);
          expect(screen.getByTestId('hydration-sentinel')).toBe(sentinel);
          advanceHydrationSentinel();
          flush();
          expect(sentinel).toHaveAttribute(HYDRATION_SENTINEL, String(currentHydrationSentinel()));

          // The server's controls, after the post-hydration attribute pass (a microtask). Controls
          // only the client renders (a portal's content) have no server state to keep.
          await flushMicrotasks();
          expect(formState(serverControls)).toEqual(serverFormState);

          // The same fixture rendered on the client: hydration leaves its form-state attributes.
          const clientContainer = document.createElement('div');
          document.body.append(clientContainer);
          const view = clientRender(module.fixtures[name], clientContainer);
          try {
            await flushMicrotasks();
            const clientControls = [...clientContainer.querySelectorAll('input, textarea, option')];
            const hydratedControls = serverControls.filter((control) => control.isConnected);
            expect(formStateAttributes(hydratedControls)).toEqual(
              formStateAttributes(clientControls).slice(0, hydratedControls.length),
            );
          } finally {
            view();
            clientContainer.remove();
          }
        });
      }
    });
  }
});
