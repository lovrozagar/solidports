import { expect } from 'vitest';
import { getStateAttributesProps } from './getStateAttributesProps';

describe('getStateAttributesProps', () => {
  it('converts the state fields to data attributes', () => {
    const state = {
      checked: true,
      count: 42,
      orientation: 'vertical',
    };

    const result = getStateAttributesProps(state);
    expect(result).toEqual({
      'data-checked': '',
      'data-count': '42',
      'data-orientation': 'vertical',
    });
  });

  it('changes the fields names to lowercase', () => {
    const state = {
      readOnly: true,
    };

    const result = getStateAttributesProps(state);
    expect(result).toEqual({
      'data-readonly': '',
    });
  });

  it('changes true values to a data-attribute without a value', () => {
    const state = {
      disabled: false,
      required: true,
    };

    const result = getStateAttributesProps(state);
    expect(result).toEqual({ 'data-required': '' });
  });

  it('does not include false values', () => {
    const state = {
      disabled: false,
      required: true,
    };

    const result = getStateAttributesProps(state);
    expect(result).not.toHaveProperty('data-disabled');
  });

  it('supports custom mapping', () => {
    const state = {
      checked: true,
      count: 42,
      orientation: 'vertical',
    };

    const result = getStateAttributesProps(state, {
      checked: (value) => ({ 'data-state': value ? 'checked' : 'unchecked' }),
    });

    expect(result).toEqual({
      'data-count': '42',
      'data-orientation': 'vertical',
      'data-state': 'checked',
    });
  });

  it('supports nulls returned from custom mapping', () => {
    const state = {
      checked: false,
      orientation: 'vertical',
    };

    const result = getStateAttributesProps(state, {
      checked: (value) => (value === true ? { 'data-state': 'checked' } : null),
    });

    expect(result).toEqual({
      'data-orientation': 'vertical',
    });
  });
});
