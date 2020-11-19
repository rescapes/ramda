/**
 * Created by Andy Likuski on 2017.07.03
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {reqPath} from './functions.js';
import {
  throwIfResultError,
  mappedThrowIfResultError,
  reqPathThrowing,
  reqStrPathThrowing,
  reqPathPropEqThrowing,
  findOneThrowing,
  onlyOneThrowing,
  onlyOneValueThrowing,
  findOneValueByParamsThrowing
} from './throwingFunctions.js';
import Result from 'folktale/result/index.js';
import R from 'ramda';

describe('throwingFunctions', () => {
  test('throwIfResultError', () => {
    // Use a pure function that returns Result. throwIfResultError should throw if the either is an ResultError
    expect(throwIfResultError(reqPath(['a'], {a: 1}))).toBe(1);
    expect(() => throwIfResultError(reqPath(['a', 'b'], {a: {c: 1}}))).toThrow();
  });

  test('mappedThrowIfResultError', () => {
    // Use a pure function that returns Result. throwIfResultError should throw if the either is an ResultError
    expect(mappedThrowIfResultError(() => null, reqPath(['a'], {a: 1})).unsafeGet()).toBe(1);
    expect(() => mappedThrowIfResultError(arg => `Error ${arg}`, Result.Error([1, 2]))).toThrow(
      'Error 1; Error 2'
    );
  });

  test('reqPathThrowing', () => {
    expect(reqPathThrowing(['a'], {a: 1})).toBe(1);
    expect(() => reqPathThrowing(['a', 'b'], {a: {c: 1}})).toThrow('Only found non-nil path up to a of path a.b for obj { a: { c: 1 } }');
    expect(() => reqPathThrowing(['apple', 'b'], {a: {c: 1}})).toThrow('Found no non-nil value of path apple.b for obj { a: { c: 1 } }');
  });

  test('reqStrPathThrowing', () => {
    expect(reqStrPathThrowing('foo.bar.myboo.1.gone', {
      foo: {
        bar: {
          goo: 1,
          myboo: ['is', {gone: 'forever'}]
        }
      }
    })).toEqual('forever');

    expect(() => reqStrPathThrowing('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toThrow();
  });

  test('reqPathPropEqThrowing', () => {
    expect(reqPathPropEqThrowing(['a'], 1, {a: 1})).toBe(true);
    expect(() => reqPathPropEqThrowing(['a', 'b'], 1, {a: {c: 1}})).toThrow();
  });

  test('findOneThrowing', () => {
    // Works with objects
    expect(
      findOneThrowing(R.equals('Eli Whitney'), {a: 1, b: 'Eli Whitney'})
    ).toEqual(
      {b: 'Eli Whitney'}
    );

    // Works with arrays
    expect(
      findOneThrowing(R.equals('Eli Whitney'), [1, 'Eli Whitney'])
    ).toEqual(
      ['Eli Whitney']
    );

    // None
    expect(
      () => findOneThrowing(R.equals('Eli Whitney'), {a: 1, b: 2})
    ).toThrow();

    // Too many
    expect(
      () => findOneThrowing(R.equals('Eli Whitney'), {a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('onlyOneThrowing', () => {
    expect(
      onlyOneThrowing({a: 'Eli Whitney'})).toEqual(
      {a: 'Eli Whitney'}
    );

    // None
    expect(
      () => onlyOneThrowing({})
    ).toThrow();

    // Too many
    expect(
      () => onlyOneThrowing({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('onlyOneValueThrowing', () => {
    expect(
      onlyOneValueThrowing({a: 'Eli Whitney'})).toEqual(
      'Eli Whitney'
    );

    // None
    expect(
      () => onlyOneValueThrowing({})
    ).toThrow();

    // Too many
    expect(
      () => onlyOneValueThrowing({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('findOneValueByParamsThrowing', () => {
    const items = [
      {brand: 'crush', flavor: 'grape'},
      {brand: 'fanta', flavor: 'strawberry'},
      {brand: 'crush', flavor: 'orange'}
    ];
    const params = {brand: 'crush', flavor: 'orange'};
    expect(findOneValueByParamsThrowing(params, items)).toEqual(
      {brand: 'crush', flavor: 'orange'}
    );
    const badParams = {brand: 'crush', flavor: 'pretzel'};
    expect(() => findOneValueByParamsThrowing(badParams, items)).toThrow();
    const tooGoodParams = {brand: 'crush'};
    expect(() => findOneValueByParamsThrowing(tooGoodParams, items)).toThrow();
  });
});

