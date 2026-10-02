import { describe, expect, it } from 'vitest';
import { untrack } from 'solid-js';
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreState } from './store';

function createState(state: Partial<PopupStoreState<unknown>>) {
  // Solid: the initial state is a store; spread a plain snapshot of it.
  const [initialState] = createInitialPopupStoreState<unknown, PopupStoreState<unknown>>();
  return {
    ...untrack(() => ({ ...initialState })),
    activeTriggerId: 'trigger',
    ...state,
  };
}

// Solid: selector arguments are accessors.
describe('popupStoreSelectors', () => {
  describe('isOpenedByTrigger', () => {
    it('uses the controlled open state when present', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
            openProp: true,
          }),
          () => 'trigger',
        ),
      ).toBe(true);

      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: true,
            openProp: false,
          }),
          () => 'trigger',
        ),
      ).toBe(false);
    });

    it('uses the internal open state when uncontrolled', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: true,
          }),
          () => 'trigger',
        ),
      ).toBe(true);

      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
          }),
          () => 'trigger',
        ),
      ).toBe(false);
    });

    it('requires the trigger to be active', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
            openProp: true,
          }),
          () => 'other-trigger',
        ),
      ).toBe(false);
    });
  });
});
