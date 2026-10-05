import { Avatar } from '@solidports/base-ui/avatar';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

// 1x1 transparent PNG (the test file's `TRANSPARENT_IMAGE_DATA_URI` and `DATA_URI`).
export const TRANSPARENT_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export default defineSsrFixtures(import.meta.url, {
  keepMounted: () => (
    <Avatar.Root>
      <Avatar.Image
        data-testid="image"
        keepMounted
        src={TRANSPARENT_IMAGE_DATA_URI}
        alt="Jane Doe"
      />
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar.Root>
  ),
  keepMountedNoAlt: () => (
    <Avatar.Root>
      <Avatar.Image data-testid="image" keepMounted src={TRANSPARENT_IMAGE_DATA_URI} alt="" />
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar.Root>
  ),
  cached: () => (
    <Avatar.Root>
      <Avatar.Image src={TRANSPARENT_IMAGE_DATA_URI} alt="Jane Doe" />
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar.Root>
  ),
});
