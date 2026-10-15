import { usePreference } from './usePreference';

/** Two readers of the same preference, and a button that sets it. */
export function PreferenceFixture() {
  const first = usePreference(
    () => 'variant',
    () => ['Tailwind', 'CssModules'],
    () => 'CssModules',
  );
  const second = usePreference(
    () => 'variant',
    () => 'CssModules:Tailwind',
  );
  return (
    <div>
      <span class="first">{String(first()[0])}</span>
      <span class="second">{String(second()[0])}</span>
      <button type="button" onClick={() => first()[1]('Tailwind')}>
        Tailwind
      </button>
    </div>
  );
}
