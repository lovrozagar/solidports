import { describe, expect, it } from 'vitest';
import { untrack } from 'solid-js';
import { createInitialPopupStoreState, popupStoreSelectors } from './store';
import type { PopupStoreState } from './store';

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

  describe('transitionStatus', () => {
    it('reports the starting phase while the popup is open but not yet mounted', () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: false,
          }),
        ),
      ).toBe('starting');
    });

    it('uses the controlled open state to detect the starting phase', () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            openProp: true,
            mounted: false,
          }),
        ),
      ).toBe('starting');
    });

    it('keeps the stored status once the opening cycle is mounted', () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: 'starting',
          }),
        ),
      ).toBe('starting');

      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: undefined,
          }),
        ),
      ).toBe(undefined);
    });

    it('does not start a new enter phase when an exit is reversed', () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: true,
            mounted: true,
            transitionStatus: 'ending',
          }),
        ),
      ).toBe('ending');
    });

    it('keeps the stored status while the popup is closed', () => {
      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            mounted: true,
            transitionStatus: 'ending',
          }),
        ),
      ).toBe('ending');

      expect(
        popupStoreSelectors.transitionStatus(
          createState({
            open: false,
            mounted: false,
            transitionStatus: undefined,
          }),
        ),
      ).toBe(undefined);
    });
  });
});
