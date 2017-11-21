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
const {reqPath, reqPathPropEq, findOne, onlyOne, onlyOneValue} = require('./functions');
const {Either} = require('ramda-fantasy');
const R = require('ramda');
const prettyFormat = require('pretty-format');

/**
 * Throw and exception if Either is Left
 * @param {Either} either Left value is an array of Errors to throw. Right value is success to return
 * @returns {Object} Throws or returns the contents of Right
 */
module.exports.throwIfLeft = either =>
  either.either(
    // Throw if Left
    leftValue => {
      throw new Error(R.join(', ', leftValue));
    },
    // Return the Right value
    R.identity
  );

/**
 * Throw and exception if Either is Left
 * @param {String} message The custom error message to precede the error dump
 * @param {Either} either Left value is a single error
 * @returns {Object} Throws or returns the contents of Right
 */
const throwIfSingleLeft = module.exports.throwIfSingleLeft = R.curry((message, either) =>
  either.either(
    // Throw if Left
    leftValue => {
      throw new Error(`${message}: ${prettyFormat(leftValue)}`);
    },
    // Return the Right value
    R.identity
  ));

/**
 * Like throwIfLeft but allows mapping of the unformatted Error values in Either
 * @param {Either} either Left value is an error to throw. Right value is success to return
 * The Either value (not just the Either itself) must be a Container in order to apply the mapping function
 * @param {Function} func Mapping function that maps Either.Left value. If this value is
 * an array it maps each value. If not it maps the single value
 * @returns {Right} Throws the mapped values or returns Either.Right
 */
module.exports.mappedThrowIfLeft = R.curry((func, either) =>
  either.either(
    // Throw if Left
    leftValue => {
      throw new Error(R.join(', ', R.map(func, leftValue)));
    },
    // Return the Right value
    R.identity
  )
);

/**
 * Calls functions.reqPath and throws if the reqPath does not resolve to a non-nil
 * @params {[String]} Path the Ramda lens style path, e.g. ['x', 1, 'y']
 * @params {Object} obj The obj to query
 * @returns {Object|Exception} The value of the sought path or throws
 * reqPath:: string -> obj -> a or throws
 */
module.exports.reqPath = R.curry((path, obj) =>
  reqPath(path, obj).either(
    leftValue => {
      // If left throw a helpful error
      throw new Error(
        [leftValue.resolved.length ?
          `Only found non-nil path up to ${leftValue.resolved.join('.')}` :
          'Found no non-nil value of path',
          `of ${path.join('.')} for obj ${prettyFormat(obj)}`
        ].join(' '));
    },
    // If right return the value
    R.identity
  )
);

/**
 * Calls functions.reqPathPropEq and throws if the reqPath does not resolve to a non-nil
 * @params {[String]} Path the Ramda lens style path, e.g. ['x', 1, 'y']
 * @params {*} Value to compare to result of reqPath
 * @params {Object} obj The obj to query
 * @returns {Boolean|Exception} true|false if the path is valid depending whether if the
 * resulting value matches val. throws if the path is invalid
 * reqPath:: Boolean b = string -> obj -> b or throws
 */
module.exports.reqPathPropEq = R.curry((path, val, obj) =>
  reqPathPropEq(path, val, obj).either(
    leftValue => {
      // If left throw a helpful error
      throw new Error(
        [leftValue.resolved.length ?
          `Only found non-nil path up to ${leftValue.resolved.join('.')}` :
          'Found no non-nil value of path',
          `of ${path.join('.')} for obj ${prettyFormat(obj)}`
        ].join(' '));
    },
    // If right return the value
    R.identity
  )
);

/**
 * Like R.find but expects only one match and works on both arrays and objects
 * @param {Function} predicate
 * @param {Array|Object} obj Container that should only match once with predicate
 * @returns {Object} The single item container or throws
 */
module.exports.findOne = R.curry((predicate, obj) =>
  throwIfSingleLeft('Did not find exactly one match', findOne(predicate, obj))
);

/**
 * Like findOne but without a predicate
 * @param {Array|Object} obj Container that should only match once with predicate
 * @returns {Object} The single item container or throws
 */
module.exports.onlyOne = obj =>
  throwIfSingleLeft('Did not find exactly one', R.omit(['matching'], onlyOne(obj))
);

/**
 * Like onlyOne but extracts the value from the functor
 * @param {Array|Object} obj Functor that has a values property
 * @returns {Object} The single item container or throws
 */
module.exports.onlyOneValue = obj =>
  throwIfSingleLeft('Did not find exactly one', R.omit(['matching'], onlyOneValue(obj))
  );

