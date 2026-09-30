import { expect } from 'chai';
import { getPushedThumbValues } from './getPushedThumbValues';

describe('getPushedThumbValues', () => {
  it('pushes the next thumb forward when moving past it', () => {
    const result = getPushedThumbValues({
      index: 0,
      max: 100,
      min: 0,
      minStepsBetweenValues: 0,
      nextValue: 70,
      step: 1,
      values: [20, 40],
    });

    expect(result).to.deep.equal([70, 70]);
  });

  it('ensures minimum distance between thumbs while pushing forward', () => {
    const result = getPushedThumbValues({
      index: 0,
      max: 100,
      min: 0,
      minStepsBetweenValues: 5,
      nextValue: 60,
      step: 1,
      values: [20, 40],
    });

    expect(result).to.deep.equal([60, 65]);
  });

  it('pushes previous thumbs backward when moving before them', () => {
    const result = getPushedThumbValues({
      index: 1,
      max: 100,
      min: 0,
      minStepsBetweenValues: 0,
      nextValue: -10,
      step: 1,
      values: [20, 40],
    });

    expect(result).to.deep.equal([0, 0]);
  });

  it('pushes multiple thumbs in sequence', () => {
    const result = getPushedThumbValues({
      index: 1,
      max: 100,
      min: 0,
      minStepsBetweenValues: 5,
      nextValue: 95,
      step: 1,
      values: [10, 50, 90],
    });

    expect(result).to.deep.equal([10, 95, 100]);
  });

  it('allows fractional minimum distances', () => {
    const result = getPushedThumbValues({
      index: 0,
      max: 10,
      min: 0,
      minStepsBetweenValues: 0.4,
      nextValue: 1.4,
      step: 1,
      values: [0, 1],
    });

    expect(result[0]).to.equal(1.4);
    expect(result[1]).to.equal(1.8);
  });

  it('restores pushed thumbs towards their initial value when space allows', () => {
    const initialValues = [30, 50];

    const pushed = getPushedThumbValues({
      index: 1,
      initialValues,
      max: 100,
      min: 0,
      minStepsBetweenValues: 0,
      nextValue: 20,
      step: 1,
      values: initialValues,
    });

    expect(pushed).to.deep.equal([20, 20]);

    const restored = getPushedThumbValues({
      index: 1,
      initialValues,
      max: 100,
      min: 0,
      minStepsBetweenValues: 0,
      nextValue: 35,
      step: 1,
      values: pushed,
    });

    expect(restored).to.deep.equal([30, 35]);
  });
});
