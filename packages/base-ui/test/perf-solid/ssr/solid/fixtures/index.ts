// One file per primary component, each registering the `../../cases.ts` ids it owns.
const files = import.meta.glob<{ fixtures: Record<string, () => unknown> }>('./*.tsx', {
  eager: true,
});

export const ssrFixtures: Record<string, () => unknown> = Object.assign(
  {},
  ...Object.values(files).map((file) => file.fixtures),
);
