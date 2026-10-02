import { describe, it } from 'vitest';

describe('<OTPField.Root /> with the React 17 id fallback', () => {
  // Solid: this suite covers React 17's id fallback when `React.useId` is missing during SSR;
  // Solid ids always come from the Solid runtime and the test renderer has no server render path.
  it.skip('omits generated slot ids during SSR until the client fallback is assigned', () => {});
});
