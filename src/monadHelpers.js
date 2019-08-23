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


import {rejected, of, fromPromised} from 'folktale/concurrency/task';
import * as R from 'ramda';
import * as Result from 'folktale/result';
import {reqStrPathThrowing} from './throwingFunctions';
import {Just} from 'folktale/maybe';

/**
 * Default handler for Task rejections when an error is unexpected and should halt execution
 * with a useful stack and message
 * @param {[Object]} Errors that are accumulated
 * @param {*} reject Rejection value from a Task
 * @returns {void} No return
 */
export const defaultOnRejected = R.curry((errors, reject) => {
  console.warn('Accumulated task errors:\n', errors); // eslint-disable-line no-console
  throw(reject);
});
const _onRejected = defaultOnRejected;

/**
 * Default behavior for task listener defaultOnCancelled, which simply logs
 * @returns {void} No return
 */
export const defaultOnCancelled = () => {
  console.log('The task was cancelled. This is the default action'); // eslint-disable-line no-console
};
const _onCanceled = defaultOnCancelled;

const whenDone = done => {
  if (done) {
    done();
  }
};
/**
 * Defaults the defaultOnRejected and defaultOnCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result. Example:
 * task.listen().run(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Object} obj Object of callbacks
 * @param {Function} obj.onResolved Unary function expecting the resolved value
 * @param {Function} obj.onCancelled optional cancelled handler. Default is to log
 * @param {Function} obj.onRejected optional rejected handler. Default is to throw. This function is first
 * passed the errors that have accumulated and then the final error. You should make a curried function
 * or similarly that expects two arguments, error and error
 * @param {[Object]} errors Optional list of errors that accumulated
 * @param {Function} done Optional or tests. Will be called after rejecting, canceling or resolving
 * @returns {Object} Run config with defaultOnCancelled, defaultOnRejected, and onReolved handlers
 */
export const defaultRunConfig = ({onResolved, onCancelled, onRejected}, errors, done) => {
  return ({
    onCancelled: () => {
      (onCancelled || _onCanceled)();
      whenDone(done);
    },
    onRejected: error => {
      // Since the default defaultOnRejected throws, wrap it
      try {
        (onRejected || _onRejected)(errors, error);
      } finally {
        whenDone(done);
      }
    },
    onResolved: value => {
      try {
        // Wrap in case anything goes wrong with the assertions
        onResolved(value);
      } finally {
        whenDone(done);
      }
    }
  });
};

/**
 * For a task that returns a Result.
 * Defaults the defaultOnRejected and defaultOnCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result.
 * If the task resolves to an Result.Ok, resolves the underlying value and passes it to the onResolved function
 * that you define. If the task resolves ot an Result.Error, the underlying value is passed to on Rejected.
 * rejection and cancellation resolves the underlying value of the Result.Ok or Result.Error. In practice defaultOnRejected shouldn't
 * get called directly. Rather a Result.Error should be resolved and then this function calls defaultOnRejected. cancellation
 * should probably ignores the value
 * Example:
 * task.listen().run(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Object} obj Object of callbacks
 * @param {Function} obj.onResolved Unary function expecting the resolved value
 * @param {Function} [obj.onRejected] Optional expects a list of accumulated errors and the final error. This function
 *  will be called for normal task rejection and also if the result of the task is a result.Error, in which
 *  case errors will be R.concat(errors || [], [result.Error]) and error will be result.Error
 * @param {Function} obj.onResolved Unary function expecting the resolved value of Result.Ok
 * @param {Function} obj.onCancelled Optional cancelled function
 * @param {[Object]} errors Optional accumulated errors
 * @param {Function} done Optional done function for jest
 * @returns {Object} Run config with defaultOnCancelled, defaultOnRejected, and onReolved handlers
 */
export const defaultRunToResultConfig = ({onResolved, onCancelled, onRejected}, errors, done) => {
  let finalized = false;
  // We have to do this here instead of using defaultRunConfig's version
  const reject = (errs, error) => {
    try {
      (onRejected || _onRejected)(R.concat(errs, [error]), error);
    } finally {
      finalized = true;
      whenDone(done);
    }
  };

  return defaultRunConfig({
      onResolved: result => result.map(value => {
        try {
          // Wrap in case anything goes wrong with the assertions
          onResolved(value);
        } catch (error) {
          reject(R.concat(errors || [], [error]), error);
        }
        // don't finalize here, defaultRunConfig.onResolved does that
      }).mapError(
        error => reject(R.concat(errors || [], [error]), error)
      ),
      onRejected: reject,
      onCancelled: onCancelled
    },
    errors,
    done
  );
};

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
 * @deprecated Use fromPromised from folktale/concurrency/task
 * Wraps a Promise in a Task
 * @param {Promise} promise The promise
 * @param {boolean} expectReject default false. Set true for testing to avoid logging rejects
 * @returns {Task} The promise as a Task
 */
export const promiseToTask = promise => {
  return fromPromised(() => promise)();
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
 * @param {Function} f Function that receives a Result.Ok value and returns a Task. This should not return a task
 * with a result. If it does then you don't need resultToTaskNeedingResult.
 * @param {Object} result A Result.Ok or Result.Error
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
  Ok: ({value}) => f(value).mapRejected(
    r => {
      return R.cond([
        // Chain Result.Ok to Result.Error
        [Result.Ok.hasInstance, R.chain(v => Result.Error(v))],
        // Leave Result.Error alone
        [Result.Error.hasInstance, R.identity],
        // If the rejected function didn't produce a Result then wrap it in a Result.Error
        [R.T, Result.Error]
      ])(r);
    }
  ),
  Error: of
}));

/**
 * Wraps the value of a successful task in a Result.Ok if it isn't already a Result
 * Converts a rejected task to a resolved task and
 * wraps the value of a rejected task in a Result.Error if it isn't already a Result.Error or converts
 * Result.Ok to Result.Error.
 * @param {Task} task The task to map
 * @returns {Task} The task whose resolved or rejected value is wrapped in a Result and is always resolved
 */
export const taskToResultTask = task => {
  return task.map(v => {
    return R.cond([
      // Chain Result.Ok to Result.Error
      [Result.Ok.hasInstance, R.chain(e => Result.Error(e))],
      // Leave Result.Error alone
      [Result.Error.hasInstance, R.identity],
      // If the rejected function didn't produce a Result then wrap it in a Result.Ok
      [R.T, Result.Ok]
    ])(v);
  }).orElse(v => {
    return of(R.cond([
      // Chain Result.Ok to Result.Error
      [Result.Ok.hasInstance, R.chain(e => Result.Error(e))],
      // Leave Result.Error alone
      [Result.Error.hasInstance, R.identity],
      // If the rejected function didn't produce a Result then wrap it in a Result.Error
      [R.T, Result.Error]
    ])(v));
  });
};

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
 * @param {Object|Function} predicateOrObj Like ramda's reduceWhile predicate. Accepts the accumulated value and next value.
 * These are the values of the container. If false is returned the accumulated value is returned without processing
 * more values. Be aware that for Tasks the task must run to predicate on the result, so plan to check the previous
 * task to prevent a certain task from running
 @param {Boolean} [predicateOrObj.accumulateAfterPredicateFail] Default false. Because of Tasks, we have a boolean here to allow accumulation after
 * the predicate fails. The default behavior is to not accumulate the value of a failed predicate. This makes
 * sense for things like Result where there is no consequence of evaluating them. But we have to run a Task to
 * evaluate it so we might want to quit after the previous task but also add that task result to the accumulation.
 * In that case set this true
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
    (applicatorRes, applicator) => {
      const f = R.ifElse(
        d => R.gt(d, 1),
        // Compose levels
        () => R.compose,
        // Just 1 level, no need to lift
        () => () => R.identity
      )(containerDepth);
      const composed = f(
        // This composes the number of R.lift2 calls we need. We need one per container level,
        // but the penultimate level must determine which accumulator to call, so it handles the final level by calling
        // accumulator or accumulatorForErrors
        // This is containerDept - 1 because our accumulator below handles the last level
        ...R.times(R.always(R.liftN(2)), containerDepth - 1)
      );
      return composed(
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
      )(applicatorRes, applicator);
    },
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
export const mapMDeep = R.curry((monadDepth, f, monad) => doMDeep(monadDepth, R.map, f, monad));

/**
 * Chain based on the depth of the monad
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {Function} Mapping function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped monad value
 */
export const chainMDeep = R.curry((monadDepth, f, monad) => doMDeep(monadDepth, R.chain, f, monad));

/**
 * Map/Chain/Filter etc based on the depth of the monad and the iterFunction
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {Function} func R.map, R.chain, R.filter or similar
 * @param {Function} f Mapping function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped monad value
 */
export const doMDeep = R.curry((monadDepth, func, f, monad) => R.compose(
  // This composes the number of R.liftN(N) calls we need. We need one per monad level
  ...R.times(R.always(func), monadDepth)
)(f)(monad));

/**
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value to return an obj with the value at 'value', merged with input object in its original form
 * of the function. Example: mapToResponseAndInputs(({a, b, c}) => task.of(someValue))({a, b, c}) -> task.of({a, b, c, value: someValue})
 * @param {Function} f Function expecting an object and returning a monad that can be mapped
 * @return {Object} The value of the monad at the value key merged with the input args
 */
export const mapToResponseAndInputs = f => arg => R.map(value => R.merge(arg, {value}), f(arg));

/**
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value to return an obj with the value at 'value', merged with input object in its original form
 * of the function. Example: mapToNamedResponseAndInputs('foo', ({a, b, c}) => task.of(someValue))({a, b, c}) -> task.of({a, b, c, foo: someValue})
 * @param {String} name The key name for the output
 * @param {Function} f Function expecting an object and returning a monad that can be mapped
 * @param {Object} arg The object containing the incoming named arguments that f is called with
 * @return {Object} The value of the monad at the value key merged with the input args
 */
export const mapToNamedResponseAndInputs = R.curry((name, f, arg) => R.map(
  value => R.merge(
    arg,
    {[name]: value}
  ),
  // Must return a monad
  f(arg)
));

/**
 * Same as mapToNamedResponseAndInputs but works with a non-monad
 * @param {String} name The key name for the output
 * @param {Function} f Function expecting an object and returning an value that is directly merged with the other args
 * @param {Object} arg The object containing the incoming named arguments that f is called with
 * @return {Object} The output of f named named and merged with arg
 */
export const toNamedResponseAndInputs = R.curry((name, f, arg) => {
  const monadF = _arg => Just(f(_arg));
  const just = mapToNamedResponseAndInputs(name, monadF, arg);
  return just.unsafeGet();
});

/**
 * Like mapToNamedResponseAndInputs but operates on one incoming Result.Ok|Error and outputs a monad with it's internal
 * value containing a Result along with the other unaltered input keys. If the incoming instance is a Result.Ok, it's
 * value is passed to f. Otherwise f is skipped.
 * The f function must produce monad whose internal value may or may not be a Result
 * If the f does not produce its own Result.Ok/Result.Error, use the flag needsFunctionOutputWrapped=true.
 * The logic for this function is that often we are composing a monad like a Task whose returned value might or
 * might not be a Result. But for the sake of composition, we always want to get a Result wrapped in a monad back
 * from each call of the composition. We also want to keep passing unaltered input parameters to each call in the composition
 *
 * @param {Object} inputOutputConfig
 * @param {String} [inputOutputConfig.resultInputKey] A key of arg that is a Result.Ok.
 * The value of this is passed to f with the key inputKey. If not specified all of inputObj is expected to be a result
 * and it's value is passed to f
 * @param {String} [inputOutputConfig.inputKey] A key name to use to pass arg[resultInputKey]'s value in to f. Only
 * specify if resultInputKey is
 * @param {String} [inputOutputConfig.resultOutputKey] The key name for the output,
 * it should have a suffix 'Result' since the output is always a Result. If not specified then the result of f
 * is returned instead of assigning it to resultOutputKey
 * @param {String} inputOutputConfig.monad Specify the outer monad, such as Task.of, in case the incoming
 * Result is a Result.Error and we therefore can't run f on its mapped value. This is not used on the Result that is
 * returned by f, since even if that is a Result.Error f will have it wrapped in the monad.
 * @param {Boolean} [inputOutputConfig.needsFunctionOutputWrapped] Default false. Set true if the value of the monad produced
 * by f is not a Result. This will map the monad's value to a Result.Ok producing a Result within a Monad
 * @param {Function} f Function expecting arg merged with the underlying value of result at and returning a monad that can be mapped
 * @param {Object} inputObj The object containing the incoming named arguments that f is called with in addition to the Result
 * at obj[resultInputKey] that has been mapped to its underlying value at key inputKey. obj[resultInputKey] is omitted from the
 * object passed to f since it's underlying value is being passed. The output of f must be a monad such as a Task but it's underlying
 * value must NOT be a Result, because the value will be mapped automatically to a result. If you want f to produce a
 * Monad<Result> instead of a Monad<value>, use chainResultToNamedResponseAndInputs
 * @return {Object} The value produced by f mapped to a result and assigned to resultOutputKey and the rest of the key/values
 * from inputObj unchanged. Note that only the value at resultOutputKey is a Result.Ok|Error
 * Example: See unit test
 *
 */
export const mapResultMonadWithOtherInputs = R.curry(
  // Map Result inputObj[resultInputKey] to a merge of its value at key inputKey with inputObj (inputObj omits resultInputKey)
  // Monad M, Result R: R a -> R M b
  ({resultInputKey, inputKey, resultOutputKey, wrapFunctionOutputInResult, monad}, f, inputObj) => {
    let remainingInputObj, inputResult;
    if (resultInputKey) {
      // Omit resultInputKey since we need to process it separately
      remainingInputObj = R.omit([resultInputKey], inputObj);
      // inputObj[resultInputKey] must exist
      inputResult = reqStrPathThrowing(resultInputKey, inputObj);
    } else {
      // No resultInputKey, so the the entire input is an inputObj
      remainingInputObj = {};
      inputResult = inputObj;
    }

    // If we have a resultOutputKey, put the result under that key and
    const mapResultToOutputkey = (_resultOutputKey, _remainingInputObj, result) => R.ifElse(
      R.always(_resultOutputKey),
      // Leave the remainingInputObj out
      _result => R.merge(_remainingInputObj, {[_resultOutputKey]: _result}),
      // If there is anything in the remainingInputObj, merge it with the result.value
      _result => R.map(R.merge(_remainingInputObj), _result)
    )(result);

    // If our incoming Result is a Result.Error, just wrap it in the monad with the expected resultOutputKey
    // This is the same resulting structure if the f produces a Result.Error
    if (Result.Error.hasInstance(inputResult)) {
      return inputResult.orElse(
        error => monad(mapResultToOutputkey(resultOutputKey, remainingInputObj, inputResult))
      );
    }
    return R.chain(
      value => R.compose(
        resultMonad => R.map(result => mapResultToOutputkey(resultOutputKey, remainingInputObj, result), resultMonad),
        // Wrap the monad value from f in a Result if needed (if f didn't produce one)
        // Monad M: Result R: M b | M R b -> M R b
        outputMonad => R.when(
          R.always(wrapFunctionOutputInResult),
          mon => R.map(
            m => Result.Ok(m),
            mon
          )
        )(outputMonad),
        // Call f on the merged object
        // Monad M: Result R: R <k, v> -> M b | M R b
        obj => f(obj),
        // Merge the inputObj with the valued value
        // Assign the value to inputKey if it's specified
        // Result R: R a -> <k, v>
        v => R.merge(remainingInputObj, R.when(R.always(inputKey), vv => ({[inputKey]: vv}))(v))
      )(value),
      inputResult
    );
  }
);

/**
 * Version of mapResultMonadWithOtherInputs for Tasks as the monad and expects
 * resultInputKey to end in the word 'Result' so inputKey can be the same key without that ending.
 */
export const mapResultTaskWithOtherInputs = R.curry(
  ({resultInputKey, resultOutputKey, wrapFunctionOutputInResult}, f, inputObj) => {
    // assign inputKey to resultInputKey value minus Result if resultInputKey is specified
    const inputKey = R.when(
      R.identity,
      rik => {
        const key = R.replace(/Result$/, '', rik);
        if (R.concat(key, 'Result') !== rik) {
          throw new Error(`Expected resultInputKey to end with 'Result' but got ${resultInputKey}`);
        }
        return key;
      }
    )(resultInputKey);
    return mapResultMonadWithOtherInputs(
      {resultInputKey, inputKey, resultOutputKey, wrapFunctionOutputInResult, monad: of},
      f,
      inputObj
    );
  }
);

/**
 * Like mapToResponseAndInputs, but resolves the value of the monad to a certain path and gives it a name .
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value, getting its value at strPath and giving it the key name, them merge it with the input object in its original form
 * of the function.
 * Example: mapToResponseAndInputs('billy', 'is.1.goat', ({a, b, c}) => task.of({is: [{cow: 'grass'}, {goat: 'can'}]}))({a, b, c}) ->
 * task.of({a, b, c, billy: 'can'})
 * @param {String} name The key name for the output
 * @param {String} strPath dot-separated path with strings and indexes
 * @param {Function} f Function that returns a monad
 * @returns {Object} The resulting monad containing the strPath value of the monad at the named key merged with the input args
 */
export const mapToNamedPathAndInputs = R.curry(
  (name, strPath, f) => arg => R.map(
    // Container value
    value => {
      // It has to be an object to be merged
      if (R.not(R.is(Object, value))) {
        throw new Error(`value ${value} is not an object. arg: ${arg}, f: ${f}`);
      }
      // Merge the current args with the value object
      return R.merge(
        arg,
        {[name]: reqStrPathThrowing(strPath, value)}
      );
    },
    f(arg)
  )
);

/**
 * Calls a function that returns a monad and maps the result to the given string path
 * @param {String} strPath dot-separated path with strings and indexes
 * @param {Function} f Function that returns a monad
 * @returns {*} The monad containing the value at the string path
 */
export const mapToPath = R.curry(
  (strPath, monad) => R.map(
    // Container value
    value => {
      // Find the path in the returned value
      return reqStrPathThrowing(strPath, value);
    },
    monad
  )
);

/**
 * Calls a function with arg that returns a monad and maps the result to the given string path
 * @param {String} strPath dot-separated path with strings and indexes
 * @param {Function} f Function that returns a monad
 * @param {*} arg Passed to f
 * @returns {*} The monad containing the value at the string path
 */
export const mapWithArgToPath = R.curry(
  (strPath, f) => arg => R.map(
    // Container value
    value => {
      // Find the path in the returned value
      return reqStrPathThrowing(strPath, value);
    },
    f(arg)
  )
);

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
