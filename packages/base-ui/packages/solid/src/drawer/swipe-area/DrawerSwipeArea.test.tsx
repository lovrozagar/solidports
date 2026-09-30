import * as DrawerModule from '@solidports/base-ui/drawer';
import { describe, expect, it } from 'vitest';

describe('<Drawer.SwipeArea />', () => {
  it('is not part of the public DrawerPreview API', () => {
    expect('SwipeArea' in DrawerModule.DrawerPreview).toBe(false);
  });

  it('is not exported from @solidports/base-ui/drawer', () => {
    expect('DrawerSwipeArea' in DrawerModule).toBe(false);
  });
});
