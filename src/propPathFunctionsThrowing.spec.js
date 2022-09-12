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

import {reqPathPropEqThrowing, reqPathThrowing, reqStrPathThrowing} from './propPathFunctionsThrowing.js';

describe('propPathFunctionsThrowing', () => {
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
});

