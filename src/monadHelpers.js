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
import * as Result from 'folktale/result/index';
import {chainObjToValues, mapObjToValues, mergeDeep} from './functions';

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
 * Passes a result to a function that returns a Task an maps the successful Task value to a Result.Ok
 * and erroneous task to a Result.Error. If result is an error it is wrapped in a Task.Of
 * @param {Function} f Function that receives result and returns a Task. This should not return a task
 * with a result. If it does then you don't need resultToTaskNeedingResult.
 * @param {Object} result A Result.Ok or Result.Eror
 * @returns {Object} Task with Result.Ok or Result.Error inside.
 * @sig resultToTaskNeedingResult:: Result r, Task t => (r -> t) -> r -> t r
 */
export const resultToTaskNeedingResult = R.curry((f, result) => result.matchWith({
  Ok: ({value}) => f(value).map(Result.Ok).mapRejected(Result.Error),
  Error: of
}));

/**
 * Passes a result to a function that returns a Task containing a Result
 * and erroneous task maps converts a Result.Ok to a Result.Error. If result is an error it is wrapped in a Task.Of
 * @param {Function} f Function that receives result and returns a Task with a Result in it.
 * @param {Object} result A Result.Ok or Result.Error
 * @returns {Object} Task with Result.Ok or Result.Error inside.
 * @sig resultToTaskNeedingResult:: Result r, Task t => (r -> t r) -> r -> t r
 */
export const resultToTaskWithResult = R.curry((f, result) => result.matchWith({
  Ok: ({value}) => f(value).mapRejected(r => r.chain(v => Result.Error(v))),
  Error: of
}));

/**
 * A version of traverse that also reduces. I'm sure there's something in Ramda for this, but I can't find it.
 * Same arguments as reduce, but the initialValue must be an applicative, like task.of({}) or Result.of({})
 * f is called with the underlying value of accumulated applicative and the underlying value of each list item,
 * which must be an applicative
 * @param {Function} accumulator Accepts the value of the reduced container and each result of sequencer,
 * then returns a value that will be wrapped in a container for the subsequent interation
 * Container C v => v -> v -> v
 * @param {Object} initialValue A container to be the initial reduced value of accumulator
 * @param {[Object]} list List of contianer
 * @returns {Object} The value resulting from traversing and reducing
 * @sig traverseReduce:: Container C v => (v -> v -> v) -> C v -> [C v] -> C v
 */
export const traverseReduce = (accumulator, initialValue, list) => R.reduce(
  (containerResult, container) => containerResult.chain(
    res => container.map(v => accumulator(res, v))
  ),
  initialValue,
  list
);

/**
 * A version of traverse that also reduces. I'm sure there's something in Ramda for this, but I can't find it.
 * The first argument specify the depth of the container (monad). So a container of R.compose(Task.of Result.Ok(1)) needs
 * a depth or 2. A container of R.compose(Task.of, Result.Ok)([1,2,3]) needs a depth of 3, where the array is the 3rd container
 * if you are operating on individual items. If you're treating the array as an singular entity then it remains level 2.
 * After that Same arguments as reduce, but the initialValue must be an applicative,
 * like task.of({}) or Result.of({}) (both level 1) or R.compose(Task.of, Result.Ok(0)) if adding values (level 2)
 * or R.compose(Task.of, Result.Ok, Array.of)() (level 3) if combining each array item somehow.
 * @param {Function} accumulator Accepts a reduced applicative and each result of sequencer, then returns the new reduced applicative
 * Container C v => v -> v -> v
 * @param {Object} initialValue A conatiner to be the initial reduced value of accumulator. This must match the
 * expected container type
 * @param {[Object]} list List of containers. The list does not itself count as a container toward containerDepth. So a list of Tasks of Results is still level containerDepth: 2
 * @returns {Object} The value resulting from traversing and reducing
 * @sig traverseReduceDeep:: Number N, N-Depth-Container C v => N -> (v -> v -> v) -> C v -> [C v] -> C v
 */
export const traverseReduceDeep = R.curry((containerDepth, accumulator, initialValue, deepContainers) =>
  R.reduce(
    (applicatorRes, applicator) => R.compose(
      // This composes the number of R.lift2 calls we need. We need one per container level
      // The first one (final step of compose) is the call to the accumulator function with the lifted values
      ...R.times(R.always(R.liftN(2)), containerDepth)
    )(accumulator)(applicatorRes, applicator),
    initialValue,
    deepContainers
  )
);


/**
 * A version of traverseReduce that also reduces until a boolean condition is met.
 * Same arguments as reduceWhile, but the initialValue must be an applicative, like task.of({}) or Result.of({})
 * f is called with the underlying value of accumulated applicative and the underlying value of each list item,
 * which must be an applicative
 * @param {Object|Function} predicateOrObj Like ramda's reduceWhile predicate. Accepts the accumulated value an next value.
 * These are the values of the container. If false is returned the accumulated value is returned without processing
 * more values. Be aware that for Tasks the task must run to predicate on the result, so plan to check the previous
 * task to prevent a certain task from running
 @param {Boolean} [predicateOrObj.accumulateAfterPredicateFail] Default false. Because of Tasks, we have a boolean here to allow accumulation after
 * the predicate fails. The default behavior is to not accumulate the value of a failed predicate. This makes
 * sense for things like Result where there is no consequence of evaluating them. But we have to run a Task to
 * evaluate it so, so we might want to quit after the previous task but also add that task result to the accumulation.
 * In that case set this tru
 * @param {Function} accumulator Accepts a reduced applicative and each result of sequencer, then returns the new reduced applicative
 * false it "short-circuits" the iteration and returns teh current value of the accumulator
 * @param {Object} initialValue An applicative to be the intial reduced value of accumulator
 * @param {[Object]} list List of applicatives
 * @returns {Object} The value resulting from traversing and reducing
 */
export const traverseReduceWhile = (predicateOrObj, accumulator, initialValue, list) => {
  // Determine if predicateOrObj is just a function or also an object
  const {predicate, accumulateAfterPredicateFail} =
    R.ifElse(
      R.is(Function),
      () => ({predicate: predicateOrObj, accumulateAfterPredicateFail: false}),
      R.identity)(predicateOrObj);

  return R.reduce(
    (applicatorRes, applicator) => {
      return applicatorRes.chain(
        result => {
          return R.ifElse(
            R.prop('@@transducer/reduced'),
            // Done, wrap it in the type. This will get called for every container of the reduction,
            // since the containers are chained together. But we'll never map our applicator again
            res => initialValue.map(R.always(res)),
            () => applicator.map(value => {
              // If the applicator's value passes the predicate, accumulate it and process the next item
              // Otherwise we stop reducing by returning R.reduced()
              return R.ifElse(
                v => predicate(result, v),
                v => accumulator(result, v),
                // We have to detect this above ourselves. R.reduce can't see it for deferred types like Task
                // IF the user wants to add v to the accumulation after predicate failure, do it.
                v => R.reduced(accumulateAfterPredicateFail ? accumulator(result, v) : result)
              )(value);
            })
          )(result);
        }
      );
    },
    initialValue,
    list
  ).chain(value => {
    // Strip reduced if if was returned on the last iteration
    return initialValue.map(() => R.ifElse(
      R.prop('@@transducer/reduced'),
      res => R.prop('@@transducer/value', res),
      R.identity
    )(value));
  });
};


/**
 * Like traverseReduceDeep but also accepts an accumulate to deal with Result.Error objects.
 * Like traverseReduceDeep accumulator is called on Result.Ok values, but Result.Error values are passed to
 * accumulatorError. The returned value is within the outer container(s): {Ok: accumulator result, Error: errorAccumulator result}
 *
 * Example:
 * traverseReduceDeepResults(2, R.flip(R.append), R.concat, Task.of({Ok: Result.Ok([]), Error: Result.Error('')}), [Task.of(Result.Ok(1), Task.of(Result.Error('a'),
 * Task.of(Result.Ok(2), Task.of(Result.Error('b')])
 * returns Task.of({Ok: Result.Ok([1, 2]), Error: Result.Error('ab')})
 *
 * @param {Function} accumulator Accepts a reduced applicative and each result that is a Result.Ok of reducer, then returns the new reduced applicative
 * Container C v => v -> v -> v where the Container at containerDepth must be a Result
 * @param {Function} accumulatorForErrors Accepts a reduced applicative and each result that is a Result.Error of reducer, then returns the new reduced applicative
 * Container C v => v -> v -> v where the Container at containerDepth must be a Result
 * @param {Object} initialValue A container to be the initial reduced values of accumulators. This must match the
 * expected container type up to the Result and have an object with two initial Results: {Ok: initial Result.Ok, Error: initial Result.Error}
 * @param {[Object]} list List of containers. The list does not itself count as a container toward containerDepth. So a list of Tasks of Results is still level containerDepth: 2
 * @returns {Object} The value resulting from traversing and reducing
 * @sig traverseReduceDeep:: Number N, N-Depth-Container C v => N -> (v -> v -> v) -> C v -> [C v] -> C v
 */
export const traverseReduceDeepResults = R.curry((containerDepth, accumulator, accumulatorForErrors, initialValue, deepContainers) =>
  R.reduce(
    (applicatorRes, applicator) => R.compose(
      // This composes the number of R.lift2 calls we need. We need one per container level,
      // but the penultimate level must determine which accumulator to call, so it handles the final level by calling
      // accumulator or accumulatorForErrors
      // This is containerDept - 1 because our accumulator below handles the last level
      ...R.times(R.always(R.liftN(2)), containerDepth - 1)
    )(
      (accumulatedObj, result) => result.matchWith({
        Ok: ({value}) => ({
          Ok: accumulator(accumulatedObj.Ok, value),
          Error: accumulatedObj.Error
        }),
        Error: ({value}) => ({
          Error: accumulatorForErrors(accumulatedObj.Error, value),
          Ok: accumulatedObj.Ok
        })
      })
    )(applicatorRes, applicator),
    initialValue,
    deepContainers
  )
);


/**
 * Converts objects with monad values into list of [M [k,v]]
 * @param {Function} monadConstructor Constructs the one-level monad, e.g. Result.Ok
 * @param {Object} objOfMonads Object with String keys and value that are monads matching that of the constructor
 * e.g. {a: Result.Ok(1), b: Result.Ok(2)}
 * @returns {[Object]} A list of the same type of Monads but containing an array with one key value pair
 * e.g. [Result.Ok([['a',1]]), Result.Ok(['b', 2])]
 * @sig objOfMLevelDeepMonadsToListWithPairs:: Monad M, String k => <k, M v> -> [M [k, v] ]
 */
export const objOfMLevelDeepMonadsToListWithPairs = R.curry((monadDepth, monadConstructor, objOfMonads) => {
  // Lifts k, which is not a monad, to the level of the monad v, then combines them into a single pair array,
  // which is returned wrapped with the monad constructor
  const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(monadDepth, monadConstructor, (k, v) => [k, v]);
  // Here we map each key into a monad with its value, converting the k, v to an array with one pair
  // Object <k, (Result (Maybe v))> -> [Result (Maybe [[k, v]]) ]
  return R.map(
    ([k, v]) => liftKeyIntoMonad(k, v),
    R.toPairs(objOfMonads)
  );
});

/**
 * Handles objects whose values are lists of monads by sequencing each list of monads into a single monad
 * and then packaging the keys into the monad as well
 * @param {Number} monadDepth The depth of the monad for each item of the array for each value.
 * @param {Function} monadConstructor Constructs the monad so that the key can be combined with the values monad
 * @param {Function} objOfMonads Objects whose values are list of monads
 * @returns {[Monad]} A list of monads each containing and origianl key value in the form monad [[k, values]]].
 * This is thus an array with one pair, where the pair contains a key and values
 * @sig objOfMLevelDeepListOfMonadsToListWithPairs:: Monad M, String k => [<k, [M<v>]>] -> [M [k, [v]]]
 * Example {a: [Maybe.Just(1), Maybe.Just(2)], b: [Maybe.Just(3), Maybe.Just(4)]} becomes
 * [Maybe.Just(['a', [1, 2]]], Maybe.Just(['b', [3, 4]])]
 */
export const objOfMLevelDeepListOfMonadsToListWithPairs = R.curry((monadDepth, monadConstructor, objOfMonads) => {
  // Here String k:: k -> [v] -> monadConstructor [k, [v]]
  // So we lift k to the monad level and create a pair with the array of values
  const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(monadDepth, monadConstructor, (k, values) => R.prepend(k, [values]));
  return R.compose(
    R.map(([k, v]) => liftKeyIntoMonad(k, v)),
    R.toPairs,
    // Map each value and then sequence each monad of the value into a single monad containing an array of values
    // Monad m:: <k, [m v]> -> <k, m [v]>
    R.map(monadValues => traverseReduceDeep(
      monadDepth,
      // Prev is an array of previous monad values. Next is a value from monadValues
      (prev, next) => R.append(next, prev),
      monadConstructor([]),
      monadValues
    ))
  )(objOfMonads);
});

/**
 * Like objOfMLevelDeepListOfMonadsToListWithPairs but where the input is already pairs
 * The monad depth should be the depth of each monad in each list + 1 where 1 accounts for each list, which we
 * want to treat as a monad layer.
 */
export const pairsOfMLevelDeepListOfMonadsToListWithPairs = R.curry((monadDepth, monadConstructor, pairsOfMonads) => {
  // Here String k:: k -> [v] -> monadConstructor [k, [v]]
  // So we lift k to the monad level and create a pair with the array of values
  const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(monadDepth, monadConstructor, (k, values) => R.prepend(k, [values]));
  return R.compose(
    R.map(([k, v]) => liftKeyIntoMonad(k, v)),
    // Map each value and then sequence each monad of the value into a single monad containing an array of values
    // Monad m:: [k, [m v]> -> [k, m [v]]
    pairs => R.map(([k, monadValues]) => [
      k,
      traverseReduceDeep(
        monadDepth,
        // Prev is an array of previous monad values. Next is a value from monadValues
        (prev, next) => R.append(next, prev),
        monadConstructor(),
        monadValues
      )
    ], pairs)
  )(pairsOfMonads);
});

/**
 * Lifts an M level deep monad using the given M-level monad constructor and applies a 2 argument function f
 * The given value is called as the first argument of f, the second argument if the unwrapped value of the monad
 * The value returned by f is converted back to a monad. So this is essentially monad.chain(v => f(value, v)
 * but the chaining works on the given depth. This is useful for key value pairs when the key and value
 * need to be packaged into the monad that is the value.
 *
 * Inspiration: https://github.com/MostlyAdequate/mostly-adequate-guide (Ch 10)
 * const tOfM = compose(Task.of, Maybe.of);
 liftA2(liftA2(concat), tOfM('Rainy Days and Mondays'), tOfM(' always get me down'));
 * Task(Maybe(Rainy Days and Mondays always get me down))
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

/**
 * Map based on the depth of the monad
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {Function} Mapping function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped monad value
 */
export const mapMDeep = R.curry((monadDepth, f, monad) => R.compose(
  // This composes the number of R.liftN(N) calls we need. We need one per monad level
  ...R.times(R.always(R.map), monadDepth)
)(f)(monad));


/*
export function liftObjDeep(obj, keys = []) {
  if (R.anyPass([Array.isArray, R.complement(R.is)(Object)])(obj)) {
    return R.cond([
      [Array.isArray,
        a => R.liftN(R.length(keys) + 1, (...args) => args)(R.addIndex(R.map)(
          (v, k) => v,
          a
        ))
      ],
      [R.T,
        o => R.liftN(R.length(keys) + 1, (...args) => args)([o])
      ]
    ])(obj);
  }

  // Get all combinations at this level. To do this we look at array values and scalars
  // We put the scalar in a single array
  return R.compose(
    R.when(
      pairs => {
        return R.compose(R.lt(1), R.length)(pairs);
      },
      pairs => R.liftN(R.length(pairs), (...args) => [...args])(...R.map(R.compose(Array.of, R.last), pairs))
    ),
    //R.toPairs,
    //R.map(R.unless(Array.isArray, Array.of)),
    o => chainObjToValues(
      (v, k) => liftObjDeep(v, R.concat(keys, [k])),
      o
    )
  )(obj);
};
*/
