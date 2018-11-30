/**
 * Created by Andy Likuski on 2018.05.10
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


import {task as folktask, rejected, of} from 'folktale/concurrency/task';
import * as R from 'ramda';
import {mapObjToValues, traverseReduce} from './functions';
import * as Result from 'folktale/result/index';
import * as Maybe from 'folktale/maybe/index';

/**
 * Default handler for Task rejections when an error is unexpected and should halt execution
 * with a useful stack and message
 * @param {*} reject Rejection value from a Task
 * @returns {void} No return
 */
export const onRejected = reject => {
  throw(reject);
};

/**
 * Default behavior for task listener onCancelled, which simply logs
 * @returns {void} No return
 */
export const onCancelled = () => {
  console.log('The task was cancelled. This is the default action'); // eslint-disable-line no-console
};

/**
 * Defaults the onRejected and onCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result. Example:
 * task.listen().run(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Function} onResolved Unary function expecting the resolved value
 * @returns {Object} Run config with onCancelled, onRejected, and onReolved handlers
 */
export const defaultRunConfig = ({onResolved}) => ({
  onCancelled,
  onRejected,
  onResolved
});

/**
 * For a task that returns an Result.
 * Defaults the onRejected and onCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result.
 * If the task resolves to an Result.Ok, resolves the underlying value and passes it to the onResolved function
 * that you define. If the task resolves ot an Result.Error, the underlying value is passed to on Rejected.
 * rejection and cancellation resolves the underlying value of the Result.Ok or Result.Error. In practice onRejected shouldn't
 * get called directly. Rather a Result.Error should be resolved and then this function calls onRejected. cancellation
 * should probably ignores the value
 * Example:
 * task.listen().run(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Function} onResolved Unary function expecting the resolved value
 * @returns {Object} Run config with onCancelled, onRejected, and onReolved handlers
 */
export const defaultRunToResultConfig = ({onResolved}) => ({
  onCancelled,
  onRejected: result => result.map(onRejected).mapError(onRejected),
  // resolve Result.Ok, reject Result.Error
  onResolved: result => result.map(onResolved).mapError(onRejected)
});

/**
 * Wraps a Task in a Promise.
 * @param {Task} task The Task
 * @returns {Promise} The Task as a Promise
 */
export const taskToPromise = (task) => {
  if (!task.run) {
    throw new TypeError(`Expected a Task, got ${typeof task}`);
  }
  return task.run().promise();
};

/**
 * Wraps a Promise in a Task
 * @param {Promise} promise The promise
 * @param {boolean} expectReject default false. Set true for testing to avoid logging rejects
 * @returns {Task} The promise as a Task
 */
export const promiseToTask = (promise, expectReject = false) => {
  if (!promise.then) {
    throw new TypeError(`Expected a Promise, got ${typeof promise}`);
  }
  return folktask(resolver => promise.then(resolver.resolve).catch(resolver.reject));
};

/**
 * Natural transformation of a Result to a Task. This is useful for chained tasks that return Results.
 * If the Result is a Result.Error, a Task.reject is called with the value. If the Result is a Result.Ok,
 * a Task.of is created with the value
 * @param {Result} result A Result.Ok or Result.Error
 * @returns {Task} The Task.of or Task.reject
 */
export const resultToTask = result => result.matchWith({
  Ok: ({value}) => of(value),
  Error: ({value}) => rejected(value)
});

/**
 * Converts objects with monad values into list of monads([[k,v], [k,v], ...])
 * @param {Function} monadConstructor Constructs the one-level monad, e.g. Result.Ok
 * @param {Object} objOfMonads Object with String keys and value that are monads matching that of the constructor
 * e.g. {a: Result.Ok(1), b: Result.Ok(2)}
 * @returns {[Object]} A list of the same type of Monads but containing an array with one key value pair
 * e.g. [Result.Ok([['a',1]]), Result.Ok(['b', 2])]
 * @sig objOfMLevelDeepMonadsToListWithSinglePairs:: Monad M, String k => <k, M<v>> -> [M<[k, v]>]
 */
export const objOfMLevelDeepMonadsToListWithSinglePairs = R.curry((monadDepth, monadConstructor, objOfMonads) => {
  // Lifts k, which is not a monad, to the level of the monad v, then combines them into a single pair array,
  // which is returned wrapped with the monad constructor
  const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(monadDepth, monadConstructor, (k, v) => [[k, v]]);
  // Here we map each key into a monad with its value, converting the k, v to an array with one pair
  // Object <k, (Result (Maybe v))> -> [Result (Maybe [[k, v]]) ]
  return R.map(
    ([k, v]) => liftKeyIntoMonad(k, v),
    R.toPairs(objOfMonads)
  );
});

export const objOfMLevelDeepListOfMonadsToListWithSinglePairs = R.curry((monadDepth, monadConstructor, objOfMonads) => {
  const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(monadDepth, monadConstructor, (k, v) => [[k, v]]);
  return R.compose(
    //R.map(([k, v]) => liftKeyIntoMonad(k, v)),
    //R.toPairs,
    R.map(R.sequence(liftKeyIntoMonad))
  )(objOfMonads);
});

/**
 * TODO move to rescape-ramda
 * This handles an object whose values are a list of applicatives. It outputs an array
 * whose values are applicatives containing an array of arrays. The outer array contains pairs. The first of
 * each pair is each key of objOfApplicatives and the values are the combined items from the array of tasks
 *
 * @sig objOfListOfApplicativesToApplicative:: <k, [Task<v>]> -> [Task<[k, v]>]
 */
export const objOfListOfApplicativesToListOfApplicatives = (apConstructor, apMapper, objOfApplicatives, label = 'nada') => {
  apMapper = apMapper || R.map;
  return mapObjToValues(
    (v, k) => {
      console.log(label);
      return R.traverse(
        apConstructor,
        // Each ap is an applicative, namely a Task, containing a pairs representing key values. We map it
        // to put in within another key including this k
        apMapper(
          res => {
            console.log(label);
            return [k, res];
          },
          ap
        ),
        v
      );
    },
    objOfApplicatives
  );
};

/**
 * Just like objOfListOfApplicativesToListOfApplicatives but for pairs where the first value is the applicative
 * and second is the Task. This is used to maintain order and to allow a 'key' that isn't a string.
 * Map would accomplish the same but ramda methods don't play well with Map
 */
export const pairsOfListOfApplicativesToListOfApplicatives = R.curry((apConstructor, objOfApplicatives) => R.map(
  ([v, k]) => {
    return R.traverse(
      apConstructor,
      // Each ap is an applicative, such as a Task, containing a pairs representing key values.
      // We map the result of each applicative to include the k with the result
      ap => ap.map(
        res => [k, res]
      ),
      v
    );
  },
  objOfApplicatives
));

/**
 * Lifts an M level deep monad using the given M-level monad constructor and applies a 2 argument function f
 * The given value is called as the first argument of f, the second argument if the unwrapped value of the monad
 * The value returned by f is converted back to a monad. So this is essentially monad.chain(v => f(value, v)
 * but the chaining works on the given depth. This is useful for key value pairs when the key and value
 * need to be packaged into the monad that is the value.
 *
 * @param {Number} The monad depth to process values at. Note that the given monads can be deeper than
 * this number but the processing will occur at the depth given here
 * @param {Function} constructor M-level deep monad constructor
 * @param {Function} 2-arity function to combine value with the value of the last argument
 * @param {*} value Unwrapped value as the first argument of the function
 * @param {Object} monad Monad matching that of the constructor to apply the function(value) to
 * @returns {Object} the mapped monad
 * Example:
 *  const constructor = R.compose(Result.Ok, Result.Just)
 *  const myLittleResultWithMaybeAdder = lift1stOf2ForMDeepMonad(2, constructor, R.add);
 *  myLittleResultWithMaybeAdder(5)(constructor(1))) -> constructor(6);
 *  f -> Result (Just (a) ) -> Result (Just (f (value, a)))
 */
export const lift1stOf2ForMDeepMonad = R.curry((monadDepth, constructor, f, value, monad) => R.compose(
  // This composes the number of R.liftN(N) calls we need. We need one per monad level
  ...R.times(R.always(R.liftN(2)), monadDepth)
)(f)(constructor(value))(monad));
