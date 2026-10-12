import { expect } from 'vitest';
import { waitFor } from '@solidjs/testing-library';

export async function waitForPositioned(positioner: HTMLElement) {
  await waitFor(() => {
    expect(positioner.style.opacity).not.toBe('0');
  });
  await waitFor(() => {
    expect(positioner).toBeVisible();
  });
}
