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
import * as R from 'ramda';
import {inspect} from 'util';

/**
 * Stringify an error with a stack trace
 * https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
 * @param {Object} err Error
 * @return {string} The json stringified error
 */
export const stringifyError = err => {
  // If any internal error exists use it instead. I think these are always more important than the external
  // error
  const internalErrorProp = R.find(prop => R.is(Error, R.prop(prop, err)), Object.getOwnPropertyNames(err));
  const wrappedError = R.ifElse(
    () => R.isNil(internalErrorProp),
    // If the error isn't an Error object, wrap it
    err => wrapError(err),
    err => R.prop(internalErrorProp, err)
  )(err);

  const obj = R.fromPairs(R.map(
    key => [key, wrappedError[key]],
    Object.getOwnPropertyNames(wrappedError)
  ));
  // Use replace to convert escaped in stack \\n to \n
  return R.replace(/\\n/g, '\n', JSON.stringify(
    // Put message and stack first
    R.mergeRight(
      R.pick(['message', 'stack'], obj),
      R.omit(['message', 'stack'])
    ),
    null,
    2
  ));
};

/**
 * Wraps an error in Error unless it already is an Error. Useful for Result.Error strings that need to be
 * converted to errors
 * @param {*} error The value to wrap if needed
 * @return {Error} The wrapped error
 */
export const wrapError = error => {
  return R.unless(
    R.is(Error),
    e => new Error(inspect(error, {depth: 10}))
  )(error);
};
