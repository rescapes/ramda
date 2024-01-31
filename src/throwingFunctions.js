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

import {findOne, onlyOne, onlyOneValue} from './functions.js';
import Result from 'folktale/result/index.js';
import * as R from 'ramda';
import {inspect} from 'util';

/**
 * Throw and exception if Result is Result.Error
 * @param {Result} result Result.Error value is an array of Errors to throw. Result.Ok value is success to return
 * @returns {Object} Throws or returns the contents of Result.Ok. Values are '; ' separated
 */
export const throwIfResultError = result =>
  result.mapError(
    // Throw if Result.Error
    resultErrorValue => {
      throw new Error(R.join('; ', resultErrorValue));
    }
  ).unsafeGet();

/**
 * Throw and exception if Result is Result.Error
 * @param {String} message The custom error message to precede the error dump
 * @param {Result} either Result.Error value is a single error
 * @returns {Object} Throws or returns the contents of Result.Ok
 */
export const throwIfSingleResultError = R.curry((message, result) =>
  result.mapError(
    // Throw if Result.Error
    resultErrorValue => {
      throw new Error(`${message}: ${inspect(resultErrorValue, {showHidden: false, depth: 3})}`);
    }
  ).unsafeGet()
);

/**
 * Like throwIfResultError but allows mapping of the unformatted Error values in Result
 * @param {Result} either Result.Error value is an error to throw. Result.Ok value is success to return
 * The Result value (not just the Result itself) must be a Container in order to apply the mapping function
 * @param {Function} func Mapping function that maps Result.Error value. If this value is
 * an array it maps each value. If not it maps the single value
 * @returns {Result.Ok} Throws the mapped values or returns Result.Ok. Error values are '; ' separated
 */
export const mappedThrowIfResultError = R.curry((func, result) => {
    return result.mapError(
      // Throw if Result.Error
      error => {
        throw new Error(
          R.join('; ', R.map(
            e => {
              return func(e);
            },
            error)
          )
        );
      }).map(
      // Return the Result.Ok value
      R.identity
    );
  }
);


/**
 * Like R.find but expects only one match and works on both arrays and objects
 * @param {Function} predicate
 * @param {Array|Object} obj Container that should only match once with predicate
 * @returns {Object} The single item container or throws
 */
export const findOneThrowing = R.curry((predicate, obj) =>
  throwIfSingleResultError('Did not find exactly one match', findOne(predicate, obj))
);

/**
 * Like findOne but without a predicate
 * @param {Array|Object} obj Container that should only match once with predicate
 * @returns {Object} The single item container or throws
 */
export const onlyOneThrowing = obj =>
  throwIfSingleResultError('Did not find exactly one', R.omit(['matching'], onlyOne(obj))
  );

/**
 * Like onlyOne but extracts the value from the functor
 * @param {Array|Object} obj Functor that has a values property
 * @returns {Object} The single item container or throws
 */
export const onlyOneValueThrowing = obj =>
  throwIfSingleResultError('Did not find exactly one', R.omit(['matching'], onlyOneValue(obj)));

/**
 * Expects the given params when used to filter the given items to result in one item that matches
 * @param {Object} params key values where keys might match the item keys and values might match the item values
 * @param {[Object]} items Objects to test on the params
 * @returns {Object} The matching item or throw an error
 */
export const findOneValueByParamsThrowing = (params, items) => {
  return throwIfSingleResultError('Did not find exactly one', findOne(
    // Compare all theeeqProps against each item
    R.allPass(
      // Create a eqProps for each prop of params
      R.map(prop => R.eqProps(prop, params),
        R.keys(params)
      )
    ),
    R.values(items)
  ).map(R.head));
};

/** *
 * Like R.pick but requires the names to be present and not undefined in obj
 * @param {[String]} names The props to check
 * @param {Object} object The target object
 * @returns {Object} The results of R.pick or throw
 */
export const pickOrThrow = R.curry((names, obj) => {
  const missing = R.filter(
    name => {
      return !name in obj || typeof obj[name] === 'undefined';
    }, names
  );
  if (R.length(missing)) {
    throw new Error(`reqPick: Missing props ${R.join(', ', missing)} of given names ${R.join(', ', names)} of obj ${inspect(obj, {depth: 2})}`);
  }
  return R.pick(names, obj);
});

