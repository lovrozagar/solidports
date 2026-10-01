import * as DrawerModule from '@solidports/base-ui/drawer';
import { describe, expect, it } from 'vitest';

describe('<Drawer.SwipeArea />', () => {
  it('is part of the public Drawer API', () => {
    expect('SwipeArea' in DrawerModule.Drawer).toBe(true);
  });
});
