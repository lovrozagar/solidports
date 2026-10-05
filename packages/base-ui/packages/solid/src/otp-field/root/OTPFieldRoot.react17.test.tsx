import { describe, it } from 'vitest';

describe('<OTPField.Root /> with the React 17 id fallback', () => {
  // Solid: covers React 17's missing `React.useId` (ids assigned only after mount); Solid ids always come from the Solid runtime, server included, so there is no fallback to test.
  it.skip('omits generated slot ids during SSR until the client fallback is assigned', () => {});
});
