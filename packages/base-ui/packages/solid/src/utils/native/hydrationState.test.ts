/*
 * The development check of a hydrated element's server attributes: a difference between the
 * server's markup and the client's first write warns, except in the attributes a prehydration
 * script may already have changed (`scriptedAttributes`), which no longer hold the server's markup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reset } from '../warn';
import { checkHydratedAttributes } from './hydrationState';

afterEach(() => {
  reset();
  vi.restoreAllMocks();
});

/** A server element whose script set `style` and removed `hidden`, and the client's first write. */
function scriptedIndicator() {
  const el = document.createElement('span');
  el.setAttribute('role', 'presentation');
  el.setAttribute('style', '--active-tab-left: 40px');
  return { el, written: { role: 'presentation', hidden: true } };
}

describe('checkHydratedAttributes', () => {
  it('warns on attributes only the server or only the client has', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, written } = scriptedIndicator();
    checkHydratedAttributes(el, undefined, written);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toContain('server only: style; client only: hidden');
  });

  it('skips the attributes a prehydration script may have changed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, written } = scriptedIndicator();
    checkHydratedAttributes(el, ['style', 'hidden'], written);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still warns on an attribute the script does not own', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, written } = scriptedIndicator();
    el.setAttribute('data-server', '');
    checkHydratedAttributes(el, ['style', 'hidden'], written);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toContain('server only: data-server; client only: none');
  });
});
