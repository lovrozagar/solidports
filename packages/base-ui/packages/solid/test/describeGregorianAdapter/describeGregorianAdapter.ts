import { afterAll } from 'vitest';
import createDescribe from '../createDescribe';
import '../addVitestMatchers';
import { testComputations } from './testComputations';
import { testLocalization } from './testLocalization';
import { testFormats } from './testFormats';
import { DescribeGregorianAdapterParameters } from './describeGregorianAdapter.types';

function innerGregorianDescribeAdapter(parameters: DescribeGregorianAdapterParameters) {
  describe(parameters.adapter.lib, () => {
    // Solid: the expectations assume a UTC process (upstream CI); pin it so local runs agree.
    // Fixtures are built while the suite is collected, so pin it here rather than in `beforeAll`.
    const originalTZ = process.env.TZ;
    process.env.TZ = 'UTC';
    afterAll(() => {
      process.env.TZ = originalTZ;
    });

    testComputations(parameters);
    testLocalization(parameters);
    testFormats(parameters);
  });
}

type DescribeGregorianAdapter = {
  (parameters: DescribeGregorianAdapterParameters): void;
  skip: (parameters: DescribeGregorianAdapterParameters) => void;
  only: (parameters: DescribeGregorianAdapterParameters) => void;
};

export const describeGregorianAdapter = createDescribe(
  'Gregorian adapter methods',
  innerGregorianDescribeAdapter,
) as DescribeGregorianAdapter;
