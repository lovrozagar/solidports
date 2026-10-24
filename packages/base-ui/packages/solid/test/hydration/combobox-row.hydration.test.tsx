/*
 * Hydration: a server-rendered inline Combobox grid list's rows must be claimed by the client,
 * keeping the server's elements, with no hydration mismatch, on the native path (D32's sweep).
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import { ComboboxRowFixture } from './combobox-row.fixture';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('hydrated Combobox.Row', () => {
  it("claims the server's rows, natively and without a mismatch", () => {
    const html = inject('serverHtml')['combobox-row.server.tsx'];
    if (!html) {
      throw new Error('globalSetup did not server-render combobox-row.server.tsx');
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const serverRows = [...container.querySelectorAll('[role="row"]')];
    expect(serverRows.map((row) => row.getAttribute('data-testid'))).toEqual(['row-0', 'row-1']);
    const serverCells = [...container.querySelectorAll('[role="gridcell"]')];
    expect(serverCells).toHaveLength(3);
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <ComboboxRowFixture />, container);
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat/i.test(message))).toEqual([]);
    const rows = [...container.querySelectorAll('[role="row"]')];
    expect(rows).toHaveLength(2);
    rows.forEach((row, index) => {
      expect(row).toBe(serverRows[index]);
      expect(renderPathOf(row)).toBe('native');
    });
    expect(rows[1].className).toBe('second');
    const cells = [...container.querySelectorAll('[role="gridcell"]')];
    cells.forEach((cell, index) => expect(cell).toBe(serverCells[index]));
    expect(cells.map((cell) => cell.parentElement)).toEqual([rows[0], rows[0], rows[1]]);
  });
});
