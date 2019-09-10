// Original source: https://gist.github.com/plukevdh/dec4b41d5b7d67f83be630afecee499e

import * as R from 'ramda';
import {objectDiff} from './objectDiff';

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

describe("deep diffing", () => {
  const diff = objectDiff(lhs, rhs);

  it('only detects changed', () => {
    expect(R.all(k => R.prop(k, diff), ['two', 'three', 'four', 'five', 'six']));
  });

  it('diffs arrays by returning the full array of items', () => {
    expect(diff.two).toEqual([[1, 2], [1, 3]]);
  });

  it('diffs objects by returning only changed items', () => {
    expect(diff.three).toEqual({more: ['items', 'robots']});
  });

  it('detects plain value differences', () => {
    expect(diff.four).toEqual(['four', 4]);
  });

  it('detects removed values', () => {
    expect(diff.five).toEqual([5, undefined]);
  });

  it('detects added values', () => {
    expect(diff.six).toEqual([undefined, 6]);
  });
});

