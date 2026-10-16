import type * as React from 'react';
// One file per primary component, each registering the `../../cases.ts` ids it owns.
const files = import.meta.glob<{ fixtures: Record<string, React.FC> }>('./*.tsx', { eager: true });

export const ssrFixtures: Record<string, React.FC> = Object.assign(
  {},
  ...Object.values(files).map((file) => file.fixtures),
);
