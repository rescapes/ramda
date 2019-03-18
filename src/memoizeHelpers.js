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
import * as R from 'ramda';
import NamedTupleMap from 'namedtuplemap';
import {flattenObj} from './functions';

/**
 *
 * Code modified from memoize-immutable. Memoizes a function using a flatArg version of the args
 * @param {Function} fn Function expecting any number of arguments
 * @returns {function([*], Object)} A function expecting
 * an array of the normal args for the second argument
 * an object of flattened args for the first argument
 */
const memoize = fn => {
  const cache = new NamedTupleMap();

  const memoized = R.curry((normalArgs, flatArg) => {
    if (!cache.has(flatArg)) {
      const result = R.apply(fn, normalArgs);
      cache.set(flatArg, result);
      return result;
    }
    return cache.get(flatArg);
  });


  // Give a meaningful displayName to the memoized function
  if (fn.name) {
    memoized.displayName = fn.name + 'Memoized';
  }

  return memoized;
};

/** *
 * Memomizes a function to a single argument function so that we can always NamedTupleMap for the cache.
 * In order for this to work all objects have to be flattened into one big object. This Cache won't
 * accept inner objects that have changed. So the function coverts three args like
 * {a: {wombat: 1, emu: 2}}, {b: {caracal: 1, serval: 2}}, 'hamster' to
 * {arg1.a: {wombat: 1, emu: 2}, arg2.b: {caracal: 1, serval: 2}, arg3: 'hamster}.
 * You can provide any depth of objects as arguments, but it will have performance penalties
 * Consider memoizedWith to filter out unimportant data from arguments
 * @param {Function} func A function with any number and type of args
 * @returns {Function} A function that expects the same args as func
 */
export const memoized = func => {
  return memoizedWith((...args) => args, func);
};

/** *
 * Memomizes a function to a single argument function so that we can always NamedTupleMap for the cache.
 * In order for this to work all objects have to be flattened into one big object. This Cache won't
 * accept inner objects that have changed. So the function coverts three args like
 * {a: {wombat: 1, emu: 2}}, {b: {caracal: 1, serval: 2}}, 'hamster' to
 * {arg1.a: {wombat: 1, emu: 2}, arg2.b: {caracal: 1, serval: 2}, arg3: 'hamster}.
 * You can provide any depth of objects as arguments, but it will have performance penalties.
 * To simplify the arguments and remove incomparable things like functions, use argumentFilter.
 * @param {Function} argumentFilter Expects the same number of arguments as func and returns an equal
 * number in an array. Each argument can be filtered to remove expensive objects or functions. Make
 * sure not to filter out anything that is used by func, since it will not figure into the argument uniqueness
 * @param {Function} func A function with any number and type of args. argumentFilter must match it
 * @returns {Function} A function that expects the same args as func. This function is curried, expecting
 * whatever number of arguments func is declared with, so you can call it partially
 */
export const memoizedWith = (argumentFilter, func) => {
  // memoize(func) returns the memoized function expecting args and the flattened obj
  const memo = memoize(func);
  // Returns a function expecting the args for fun
  return R.curryN(func.length, (...args) => {
    // Function that flattens the original args and called memoizedFunc with the single flattened arg
    return R.compose(
      memo(args),
      flattenObj,
      // Filter out unneeded parts of the arguments, or does nothing if argumentFilter is ...args => args
      R.apply(argumentFilter)
    )(args);
  });
};
