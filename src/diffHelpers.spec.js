// Original source: https://gist.github.com/plukevdh/dec4b41d5b7d67f83be630afecee499e

import R from 'ramda';
import {objectDiff, prettyPrintObjectDiff} from './diffHelpers';

const lhs = {
  one: 1,
  two: [1, 2],
  three: {more: 'items', over: 'here'},
  four: 'four',
  five: 5
};

const rhs = {
  one: 1,
  two: [1, 3],
  three: {more: 'robots', over: 'here'},
  four: 4,
  six: 6
};

describe('deep diffing', () => {
  const diff = objectDiff(null, lhs, rhs);
  const diffLabeled = objectDiff(['__v1', '__v2'], lhs, rhs);

  it('only detects changed', () => {
    expect(R.all(k => R.prop(k, diff), ['two', 'three', 'four', 'five', 'six'])).toEqual(true);
  });

  it('diffs arrays by returning the full array of items', () => {
    expect(diff.two).toEqual({1: {__left: 2, __right: 3}});
  });

  it('diffs objects by returning only changed items', () => {
    expect(diff.three).toEqual({more: {__left: 'items', __right: 'robots'}});
  });

  it('detects plain value differences', () => {
    expect(diff.four).toEqual({__left: 'four', __right: 4});
  });

  it('detects removed values', () => {
    expect(diff.five).toEqual([5, undefined]); // eslint-disable-line no-undefined
  });

  it('detects added values', () => {
    expect(diff.six).toEqual([undefined, 6]); // eslint-disable-line no-undefined
  });

  it('detects plain value differences with labels versions', () => {
    expect(diffLabeled.four).toEqual({__v1: 'four', __v2: 4});
  });

  it('pretty print', () => {
    expect(prettyPrintObjectDiff(null, lhs, rhs)).toEqual(JSON.stringify(diff, null, 2));
  });
});

