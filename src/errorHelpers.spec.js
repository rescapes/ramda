/**
 * Created by Andy Likuski on 2020.02.21
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import R from 'ramda';
import {stringifyError, wrapError} from './errorHelpers.js';

describe('errorHelpers', () => {
  test('wrapError', () => {
    try {
      throw {message: 'Why would an error not be an error?', and: {have: {a: {bunch: {of: 'context'}}}}}; // eslint-disable-line no-throw-literal
    } catch(obj) {
      expect(wrapError(obj).message).toBe('{\n' +
        '  message: \'Why would an error not be an error?\',\n' +
        '  and: {\n' +
        '    have: { a: { bunch: { of: \'context\' } } }\n' +
        '  }\n' +
        '}');
    }
  });
  test('stringifyError', () => {
    expect(
      R.keys(JSON.parse(R.replace(/\n/g, ' ', stringifyError(new Error('testing')))))
    ).toEqual(
      ['message', 'stack']
    );
  });
});
