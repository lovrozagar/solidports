import { expect, it } from 'vitest';
import { isInteractiveElement } from './element';

it('matches an interactive element and ignores plain or missing nodes', () => {
  const button = document.createElement('button');
  const span = document.createElement('span');
  const child = document.createElement('span');
  button.append(child);

  expect(isInteractiveElement(button)).toBe(true);
  expect(isInteractiveElement(child)).toBe(true);
  expect(isInteractiveElement(span)).toBe(false);
  expect(isInteractiveElement(null)).toBe(false);
});
