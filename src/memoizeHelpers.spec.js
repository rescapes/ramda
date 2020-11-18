/**
 * Created by Andy Likuski on 2018.12.28
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {memoized, memoizedWith} from './memoizeHelpers.js';
import R from 'ramda';
import NamedTupleMap from 'namedtuplemap';

describe('memoizeHelpers', () => {
  test('NamedTupleMap', async () => {
    const cache = new NamedTupleMap();
    const keyMap = {crazy: 8888, mother: 'hubbard'};
    const value = {any: 'thing'};
    cache.set(keyMap, value);
    const res = cache.get({crazy: 8888, mother: 'hubbard'});
    expect(res).toEqual(value);
  });

  test('memoized', () => {
    let i = 0;
    // The func increments i in order to prove that the function is memoized and only called when arguments change
    const func = (apple, orange, universe) => {
      return {apple, orange, i: i++};
    };
    const memoizedFunc = memoized(func);
    const crazy = {crazy: 888};
    const now = memoizedFunc(1, 2, crazy);
    // This should hit the cache and not call the function
    const later = memoizedFunc(1, 2, crazy);
    expect(later).toEqual(now);
    // This should call the function anew
    const muchLater = memoizedFunc(1, 2, {crazy: 889});
    expect(muchLater).toEqual(R.merge(now, {i: 1}));

    const deepTrouble = snooky => {
      i++;
      return R.view(R.lensPath('a', 'b', 'c', 'd'), snooky + i);
    };
    const deep = memoized(deepTrouble);
    expect(deep({a: {b: {c: {d: 5}}}})).toEqual((deep({a: {b: {c: {d: 5}}}})));
  });

  test('memoizedWith', () => {
    let i = 0;
    // The func increments i in order to prove that the function is memoized and only called when arguments change
    const func = (apple, orange, universe) => {
      i++;
      return {
        apple,
        orange,
        i: i + universe.crazy,
        j: i + R.or(0, R.view(R.lensPath(['alot', 'of', 'stuff', 'that', 'equals']), universe))
      };
    };

    const memoizedFunc = memoizedWith(
      (apple, orange, universe) => [apple, orange, R.omit(['alot'], universe)],
      func
    );

    const crazy = {crazy: 888, alot: {of: {stuff: {that: {equals: 5}}}}};
    // Separate args to make sure currying works
    const now = memoizedFunc(1)(2)(crazy);
    // j should have the results of even though we didn't use alot...it for the memoize
    expect(now.j).toEqual(1 + 5);
    // This should hit the cache and not call the function
    const later = memoizedFunc(1, 2, crazy);
    expect(later).toEqual(now);

    // Even though this value would give a different result, we don't consider alot... in the memoize so a cached
    // result is returned
    const offthehizzle = {crazy: 888, alot: {of: {stuff: {that: {equals: 6}}}}};
    const muchLater = memoizedFunc(1, 2, offthehizzle);
    expect(muchLater).toEqual(now);

    // When we change crazy we get a cash miss and everything updates
    const offtheshizzle = {crazy: 889, alot: {of: {stuff: {that: {equals: 6}}}}};
    const mostLater = memoizedFunc(1, 2, offtheshizzle);
    expect(mostLater).toEqual(R.merge(now, {i: 2 + 889, j: 2 + 6}));
  });
});
