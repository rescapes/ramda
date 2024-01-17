/**
 * Created by Andy Likuski on 2017.07.03
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Functions that the trowing versions from functions.js
 */

import {reqPathPropEq} from './propPathFunctions.js';
import * as R from 'ramda';
import {inspect} from 'util';

/**
 * Calls functions.reqPathPropEq and throws if the reqPath does not resolve to a non-nil
 * @params {[String]} Path the Ramda lens style path, e.g. ['x', 1, 'y']
 * @params {*} Value to compare to result of reqPath
 * @params {Object} obj The obj to query
 * @returns {Boolean|Exception} true|false if the path is valid depending whether if the
 * resulting value matches val. throws if the path is invalid
 * reqPath:: Boolean b = string -> obj -> b or throws
 */
export const reqPathPropEqThrowing = R.curry((path, val, obj) =>
  reqPathPropEq(path, val, obj).mapError(
    leftValue => {
      // If left throw a helpful error
      throw new Error(
        [leftValue.resolved.length ?
          `Only found non-nil path up to ${leftValue.resolved.join('.')}` :
          'Found no non-nil value of path',
          `of ${path.join('.')} for obj ${inspect(obj, {depth: 2})}`
        ].join(' '));
    }
  ).unsafeGet()
);
