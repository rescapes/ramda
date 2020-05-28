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

import {fromPromised, of, rejected, task, waitAll} from 'folktale/concurrency/task';
import * as R from 'ramda';
import * as Result from 'folktale/result';
import {reqStrPathThrowing} from './throwingFunctions';
import {Just} from 'folktale/maybe';
import {stringifyError} from './errorHelpers';
import {compact, isObject, toArrayIfNot} from './functions';
import {inspect} from 'util';

/**
 * Default handler for Task rejections when an error is unexpected and should halt execution
 * with a useful error message
 * @param {[Object]} Errors that are accumulated
 * @param {*} reject Rejection value from a Task
 * @returns {void} No return
 */
export const defaultOnRejected = R.curry((errors, reject) => {
  // Combine reject and errors
  const errorsAsArray = toArrayIfNot(errors);
  const allErrors = R.uniq(R.concat(errorsAsArray, [reject]));
  // Wrap each error in an Error object if it isn't already one
  console.error('Accumulated task errors:\n', // eslint-disable-line no-console
    R.join('\n', R.map(error => stringifyError(error), allErrors)
    )
  );
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

const whenDone = (errors, done) => {
  if (done) {
    done(
      R.when(
        R.identity,
        errs => R.map(
          stringifyError,
          errs || []
        )
      )(errors)
    );
  }
};


/**
 * Defaults the defaultOnRejected and defaultOnCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result. Example:
 * task.run().listen(defaultRunConfig({
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
export const defaultRunConfig = ({onResolved, onCancelled, onRejected, _whenDone}, errors, done) => {
  return ({
    onCancelled: () => {
      (onCancelled || _onCanceled)();
      whenDone(null, done);
    },
    onRejected: error => {
      _handleReject(onRejected, done, errors, error);
    },
    onResolved: value => {
      let errs = null;
      try {
        // Wrap in case anything goes wrong with the assertions
        onResolved(value);
      } catch (e) {
        // I can't import this but we don't want to process assertion errors
        if (e.constructor.name === 'JestAssertionError') {
          errs = [e];
          throw e;
        }
        const error = new Error('Assertion threw error');
        errs = [e, error];
        const reject = onRejected || _onRejected;
        reject(errs, error);
      } finally {
        (_whenDone || whenDone)(errs, done);
      }
    }
  });
};

/**
 * Given a rejection in runDefaultConfig or runDefaultToResultConfig, calls the given rejected or the default.
 * if no onRejected is given or it throws an error when called, then done is called with the errors to make the
 * test fail
 * @param {Function} onRejected Expects errors and error
 * @param {Function} done Done function
 * @param {[Object]} errs Accumulated error
 * @param {Object} error Error that caused the oReject
 * @returns {void} No return
 * @private
 */
const _handleReject = (onRejected, done, errs, error) => {
  let noThrow = true;
  let caughtError = null;
  try {
    (onRejected || _onRejected)(errs, error);
  } catch (e) {
    noThrow = false;
    caughtError = e;
  } finally {
    // If we didn't define onRejected or our onRejected threw, pass errors so jest fails
    whenDone(
      onRejected && noThrow ?
        null :
        R.concat(errs, compact([error, caughtError])),
      done
    );
  }
};

/**
 * For a task that returns a Result.
 * Defaults the defaultOnRejected and defaultOnCancelled to fail the test or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result.
 * If the task resolves to an Result.Ok, resolves the underlying value and passes it to the onResolved function
 * that you define. If the task resolves ot an Result.Error, the underlying value is passed to on Rejected.
 * rejection and cancellation resolves the underlying value of the Result.Ok or Result.Error. In practice defaultOnRejected shouldn't
 * get called directly. Rather a Result.Error should be resolved and then this function calls defaultOnRejected. cancellation
 * should probably ignores the value.
 * If you don't define onRejected an a rejection occurs or your onRejected throws an exception, the test will fail
 * Example:
 * task.run().listen(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Object} obj Object of callbacks
 * @param {Function} obj.onResolved Unary function expecting the resolved value
 * @param {Function} [obj.onRejected] Optional expects a list of accumulated errors and the final error. This function
 *  will be called for normal task rejection and also if the result of the task is a result.Error, in which
 *  case errors will be R.concat(errors || [], [result.Error]) and error will be result.Error
 * @param {Function} [obj.onCancelled] Optional cancelled function
 * @param {[Object]} errors Empty array to collect errors
 * @param {Function} done Done function from test definition
 * @returns {Object} Run config with defaultOnCancelled, defaultOnRejected, and onReolved handlers
 */
export const defaultRunToResultConfig = ({onResolved, onCancelled, onRejected}, errors, done) => {
  // We have to do this here instead of using defaultRunConfig's version
  const reject = (errs, error) => {
    _handleReject(onRejected, done, errs, error);
  };

  return defaultRunConfig({
      onResolved: result => {
        return result.map(value => {
          try {
            // Wrap in case anything goes wrong with the assertions
            onResolved(value);
          } catch (error) {
            reject(R.concat(onCancelled || [], [error]), error);
          }
          // don't finalize here, defaultRunConfig.onResolved does that
        }).mapError(
          error => reject(onCancelled || [], error)
        );
      },
      onRejected: error => reject([], error),
      onCancelled: onCancelled
    },
    errors,
    done
  );
};

/**
 * Wraps a Task in a Promise.
 * @param {Task} tsk The Task
 * @returns {Promise} The Task as a Promise
 */
export const taskToPromise = (tsk) => {
  if (!tsk.run) {
    throw new TypeError(`Expected a Task, got ${typeof tsk}`);
  }
  return tsk.run().promise();
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
export const resultToTaskWithResult = R.curry((f, result) => {
  return result.matchWith({
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
  });
});

/**
 * Wraps the value of a successful task in a Result.Ok if it isn't already a Result
 * Converts a rejected task to a resolved task and
 * wraps the value of a rejected task in a Result.Error if it isn't already a Result.Error or converts
 * Result.Ok to Result.Error.
 * @param {Task} tsk The task to map
 * @returns {Task} The task whose resolved or rejected value is wrapped in a Result and is always resolved
 */
export const taskToResultTask = tsk => {
  return tsk.map(v => {
    return R.cond([
      // Leave Result.Ok alone
      [Result.Ok.hasInstance, R.identity],
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
  (containerResult, container) => {
    return R.chain(
      res => {
        return R.map(
          v => {
            return accumulator(res, v);
          },
          container
        );
      },
      containerResult
    );
  },
  initialValue,
  list
);

/**
 * Same as traverseReduce but uses mapError to handle Result.Error or anything else that implements mapError
 * @param {function} join It's necessary to pass a join function to instruct how to extract the embedded value,
 * since Result.Error and similar don't implement chain or join. For Result.Error, join would be:
 * const join = error => error.matchWith({Error: ({value}) => value}) or simply error => error.value
 * @param {function} accumulator Accumulates the values of the monads
 * @param {object} initialValue The initial value should match an empty error monad
 * @param {[object]} list The list of error monads
 * @returns {Object} The reduced error monad
 */
export const traverseReduceError = (join, accumulator, initialValue, list) => R.reduce(
  (containerResult, container) => join(containerResult.mapError(
    res => container.mapError(v => accumulator(res, v))
  )),
  initialValue,
  list
);

/**
 * traverseReduceError specifically for Result.Error
 * @param {function} accumulator Accumulates the values of the monads
 * @param {object} initialValue The initial value should match an empty error monad
 * @param {[object]} list The list of error monads
 * @returns {Object} The reduced error monad
 */
export const traverseReduceResultError = (accumulator, initialValue, list) => {
  return traverseReduceError(
    error => {
      return error.matchWith(
        {
          Error: ({value}) => value,
          Ok: ({value}) => value
        }
      );
    },
    accumulator,
    initialValue,
    list
  );
};

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
 * Export chains a monad to a reducedMonad with the given function
 * @param {Function} f Expects the reducedMonad and the monad, returns a new reducedMonad
 * @param {Object} reducedMonad THe monad that is already reduced
 * @param {Object} monad The monad to reduce
 * @param {Number} index The index of the monad
 * @return {Object} The monad result of calling f
 */
const _chainTogetherWith = (f, reducedMonad, monad, index) => {
  return f(reducedMonad, monad, index);
};

/**
 * Version of _chainTogetherWith for task that composes a timeout every 100 calls into the chain to prevent stack overflow
 * @param {Function} f Expects the reducedMonad and the monad and an optional index, returns a new reducedMonad
 * @param {Object} reducedMonad THe monad that is already reduced
 * @param {Object} monad The monad to reduce
 * @param {Object} index So we don't break the chain all the time
 * @return {Object} The monad result of calling f
 * @private
 */
const _chainTogetherWithTaskDelay = (f, reducedMonad, monad, index) => {
  const n = 100;
  // console.log(`${index} trace: ${stackTrace.get().length}`);
  return composeWithChainMDeep(1, [
    i => f(reducedMonad, monad, i),
    // Timeout every n calls
    R.ifElse(
      i => R.not(R.modulo(i, n)),
      timeoutTask,
      of
    )
  ])(index);
};

export const timeoutTask = (...args) => {
  return task(
    (resolver) => {
      const timerId = setTimeout(() => {
        return resolver.resolve(...args);
      }, 0);
      resolver.cleanup(() => {
        clearTimeout(timerId);
      });
    }
  );
};

/**
 * Reduces a list of monads using buckets to prevent stack overflow
 * @param {Object} config
 * @param {Object} [config.buckets] Defaults to Math.max(100, R.length(monads) / 100). Divides the chained reductions into
 * @param {function} f Reduce function, expects the reducedMonad and the monad and chains them togther
 * buckets to prevent stack overflow.
 * @param {Object} initialValue The monad with the empty value, e.g. Maybe.Just([]) or Task.of(Result.Ok({}))
 * @param {[Object]} monads The list of monads
 */
const _reduceMonadsChainedBucketed = R.curry((
  {buckets},
  f,
  initialValue,
  monads
) => {
  // Bucket the tasks so each task set has up to bucketSize monads If these are still too big we'll recursively
  // break them up later. Minimum 100 per bucket
  const bucketSize = buckets || Math.max(100, Math.floor(R.length(monads) / 100));
  const monadSets = bucketedMonadSets(bucketSize, monads);

  // Process each bucket of monads with traverseReduceWhileBucketed (end case) or
  // recurse with _reduceMonadsChainedBucketed with smaller bucket size
  // The first item of each set expects the accumulation of the previous set.
  // This means we can't actually evaluate the sets yet, rather return functions
  // Monad m:: [m[a]] -> m[b]
  const reducedMonadSetFuncs = R.map(
    mSet =>
      (previousSetAccumulationMonad) => {
        return R.ifElse(
          // If we have more than 100 monads recurse, limiting the bucket size to 1 / 10 the current bucket size
          mmSet => R.compose(R.lt(100), R.length)(mmSet),
          // Take the bucketSize number of monads and recurse, this will divide into more buckets
          mmSet => {
            return _reduceMonadsChainedBucketed({buckets}, f, previousSetAccumulationMonad, mmSet);
          },
          // Small enough, do a normal R.reduce for each bucket of tasks
          // Monad m:: [[m a]] -> [b -> m [c]]
          mmSet => {
            return R.reduce(f, previousSetAccumulationMonad, mmSet);
          }
        )(mSet);
      },
    monadSets
  );

  // Reduce the buckets. We pass the previous bucket result to the next monadSetFunc to kick off the processing
  // of each monadSet
  return R.reduce(
    // Chain the resultSets together
    // Monad m:: m[[a]] -> m[a]
    (accumulatedMonadSets, monadSetFunc) => {
      return monadSetFunc(accumulatedMonadSets);
    },
    // Initial value
    initialValue,
    reducedMonadSetFuncs
  );
});


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
 * @param {Function} [predicateOrObj.mappingFunction] Defaults to R.map. The function used to each monad result from list.
 * If the accumulator does not create a new monad then R.map is sufficient. However if the accumulator does create
 * a new monad this should be set to R.chain so that the resulting monad isn't put inside the monad result
 * @param {Function} [predicateOrObj.chainTogetherWith] Defaults to _chainTogetherWith. Only needs to be overridden
 * for high stack count chaining that needs to be broken up to avoid max stack trace
 * @param {Function} [predicateOrObj.monadConstructor] Default to R.identity. Function to create a monad if mappingFunction uses R.chain. This
 * would be a task of function for task monads, an Result,Ok monad for Results, etc.
 * @param {Function} [predicateOrObj.reducer] Default R.Reduce. An alternative reducer function to use, for
 * instnace for stack handling by traverseReduceWhileBucketed
 * @param {Function} accumulator Accepts a reduced applicative and each result of sequencer, then returns the new reduced applicative
 * false it "short-circuits" the iteration and returns teh current value of the accumulator
 * @param {Object} initialValueMonad An applicative to be the intial reduced value of accumulator
 * @param {[Object]} list List of applicatives
 * @returns {Object} The value resulting from traversing and reducing
 */
export const traverseReduceWhile = (predicateOrObj, accumulator, initialValueMonad, list) => {
  // Configure the reduce function. It returns a reduce function expecting the two monads, the accumulated monad
  // and each in list
  const _reduceMonadsWithWhilst = _reduceMonadsWithWhile({predicateOrObj, accumulator, initialValueMonad});
  // Use R.reduce for processing each monad unless an alternative is specified.
  const reduceFunction = R.ifElse(R.both(isObject, R.prop('reducer')), R.prop('reducer'), () => R.reduce)(predicateOrObj);

  // By default we call
  const chainWith = R.propOr(_chainTogetherWith, 'chainTogetherWith', predicateOrObj);

  // Call the reducer. After it finishes strip out @@transducer/reduced if we aborted with it at some point
  return composeWithChain([
    reducedMonadValue => {
      // Using the initial value to get the right monad type, strip reduced if if was returned on the last iteration
      return R.map(
        () => {
          return R.ifElse(
            R.prop('@@transducer/reduced'),
            res => R.prop('@@transducer/value', res),
            R.identity
          )(reducedMonadValue);
        },
        initialValueMonad
      );
    },
    // Reduce each monad. This reducer operate on the monad level.
    // The reducer function _reduceMonadsWithWhilst. It is called with the two monads and either chains
    // them together if if the predicate passes or returns the accMonad unchanged each time once the predicate
    // fails.
    () => {
      return R.addIndex(reduceFunction)(
        (accumulatedMonad, currentMonad, index) => {
          return chainWith(
            (accMonad, app, i) => {
              return _reduceMonadsWithWhilst(accMonad, app, i);
            },
            accumulatedMonad,
            currentMonad,
            index
          );
        },
        // The monad with the empty value, e.g. Maybe.Just([]) or Task.of(Result.Ok({}))
        initialValueMonad,
        // The list of monads
        list
      );
    }
  ])();
};


/**
 * A version of traverseReduceWhile that prevents maximum call stack exceeded by breaking chains into buckets
 * Normally long lists of chained tasks keep calling a new function. We need to break this up after some number
 * of calls to prevent the maximum call stack
 * @param {Object} config The config
 * @param {Object} config.predicateOrObj Like ramda's reduceWhile predicate. Accepts the accumulated value and next value.
 * These are the values of the container. If false is returned the accumulated value is returned without processing
 * more values. Be aware that for Tasks the task must run to predicate on the result, so plan to check the previous
 * task to prevent a certain task from running
 * @param {Boolean} [config.accumulateAfterPredicateFail] Default false. Because of Tasks, we have a boolean here to allow accumulation after
 * the predicate fails. The default behavior is to not accumulate the value of a failed predicate. This makes
 * sense for things like Result where there is no consequence of evaluating them. But we have to run a Task to
 * evaluate it so we might want to quit after the previous task but also add that task result to the accumulation.
 * In that case set this true
 * @param {Function} [config.mappingFunction] Defaults to R.map. The function used to each monad result from list.
 * If the accumulator does not create a new monad then R.map is sufficient. However if the accumulator does create
 * a new monad this should be set to R.chain so that the resulting monad isn't put inside the monad result
 * @param {Function} [config.chainTogetherWith] Defaults to _chainTogetherWith. Only needs to be overridden
 * for high stack count chaining that needs to be broken up to avoid max stack trace
 * @param {Function} accumulator The accumulator function expecting the reduced monad and nonad
 * @param {Object} initialValue The initial value monad
 * @param {[Object]} list The list of monads
 * @return {Object} The reduced monad
 */
export const traverseReduceWhileBucketed = (config, accumulator, initialValue, list) => {
  return traverseReduceWhile(
    R.merge(config, {reducer: _reduceMonadsChainedBucketed({})}),
    accumulator,
    initialValue,
    list
  );
};

/**
 * Version of traverseReduceWhileBucketed that breaks tasks chaining with timeouts to prevent max stack trace errors
 * @param {Object} config The config
 * @param {Boolean} [config.accumulateAfterPredicateFail] Default false. Because of Tasks, we have a boolean here to allow accumulation after
 * the predicate fails. The default behavior is to not accumulate the value of a failed predicate. This makes
 * sense for things like Result where there is no consequence of evaluating them. But we have to run a Task to
 * evaluate it so we might want to quit after the previous task but also add that task result to the accumulation.
 * In that case set this true
 * @param {Function} [config.mappingFunction] Defaults to R.map. The function used to each monad result from list.
 * If the accumulator does not create a new monad then R.map is sufficient. However if the accumulator does create
 * a new monad this should be set to R.chain so that the resulting monad isn't put inside the monad result
 * @param {Function} [config.chainTogetherWith] Defaults to _chainTogetherWithTaskDelay
 * @param {Function} accumulator The accumulator function expecting the reduced task and task
 * @param {Object} initialValue The initial value task
 * @param {[Object]} list The list of tasks
 * @return {Object} The reduced task
 * @return {Object} The reduced monad
 */
export const traverseReduceWhileBucketedTasks = (config, accumulator, initialValue, list) => {
  // If config.mappingFunction is already R.chain, we can compose with chain since the accumulator is returning
  // a monad. If not the use composeWithMapMDeep so that the given accumulator can returns its value but our
  // composed accumulator returns a task
  const accumulatorComposeChainOrMap = R.ifElse(
    R.equals(R.chain),
    () => composeWithChainMDeep,
    () => composeWithMapMDeep
  )(R.propOr(null, 'mappingFunction', config));
  return traverseReduceWhileBucketed(
    R.merge(
      config,
      {
        monadConstructor: of,
        // This has to be chain so we can return a task in our accumulator
        mappingFunction: R.chain,
        // This adds a timeout in the chaining process to avoid max stack trace problems
        chainTogetherWith: _chainTogetherWithTaskDelay
      }
    ),
    // Call the timeout task to break the stacktrace chain. Then call the accumulator with the normal inputs.
    // Always returns a task no matter if the accumulator does or not
    (accum, current) => {
      return accumulatorComposeChainOrMap(1, [
        ([a, c]) => accumulator(a, c),
        ([a, c]) => timeoutTask([a, c])
      ])([accum, current]);
    },
    initialValue,
    list
  );
};

/**
 * Used by traverseReduceWhile to chain the accumulated monad with each subsequent monad.
 * If the value of the accumulated monad is @@transducer/reduced. The chaining is short-circuited so that
 * all subsequent values are ignored
 * @param {Object} config The config
 * @param {Function|Object} config.predicateOrObj See traverseReduceWhile
 * @param {Function} config.accumulator The accumulator
 * @returns {Function} A function expecting (accumulatedMonad, applicator, index) This function is called with
 * each accumulatedMonad and applicator by traverseReduceWhile. The index is the monad index
 * @private
 */
const _reduceMonadsWithWhile = ({predicateOrObj, accumulator, initialValueMonad}) => {
  // Determine if predicateOrObj is just a function or also an object
  const {predicate, accumulateAfterPredicateFail} = R.ifElse(
    R.is(Function),
    () => ({predicate: predicateOrObj, accumulateAfterPredicateFail: false}),
    R.identity
  )(predicateOrObj);

  // Map the applicator below with R.map unless an override like R.chain is specified
  const mappingFunction = R.propOr(R.map, 'mappingFunction', predicateOrObj);
  const monadConstructor = R.propOr(R.identity, 'monadConstructor', predicateOrObj);
  const chainTogetherWith = R.propOr(_chainTogetherWith, 'chainTogetherWith', predicateOrObj);

  return (accumulatedMonad, applicator, index) => {
    return R.chain(
      accumulatedValue => {
        return R.ifElse(
          R.prop('@@transducer/reduced'),
          // Done, we can't quit reducing since we're chaining monads. Instead we keep chaining the initialValueMonad
          // and always return the same accumulatedMonad, meaning the @@transducer/reduced valued monad
          // We use chainWith to allow breaks in chains for tasks that would otherwise cause a stack overflow
          accValue => {
            // Always returns the same thing, but break the chain occasionally to prevent stack overflow
            return chainTogetherWith(
              () => {
                return initialValueMonad.map(() => accValue);
              },
              null,
              null,
              index
            );
          },
          accValue => mappingFunction(
            value => {
              // If the applicator's value passes the predicate, accumulate it and process the next item
              // Otherwise we stop reducing by returning R.reduced()
              return R.ifElse(
                v => {
                  return predicate(accValue, v);
                },
                v => {
                  return accumulator(accValue, v);
                },
                // We have to detect this above ourselves. R.reduce can't see it for deferred types like Task
                // IF the user wants to add v to the accumulation after predicate failure, do it.
                v => {
                  // Use monadConstructor if is false so we return the right monad type if specified
                  return (accumulateAfterPredicateFail ? R.identity : monadConstructor)(
                    R.reduced(accumulateAfterPredicateFail ? accumulator(accValue, v) : accValue)
                  );
                }
              )(value);
            },
            // map or chain this
            applicator
          )
        )(accumulatedValue);
      },
      // Chain this
      accumulatedMonad
    );
  };
};
/**
 * Like traverseReduceDeep but also accepts an accumulate to deal with Result.Error objects.
 * Like traverseReduceDeep accumulator is called on Result.Ok values, but Result.Error values are passed to
 * accumulatorError. The returned value is within the outer container(s): {Ok: accumulator result, Error: errorAccumulator result}
 *
 * Example:
 * traverseReduceDeepResults(2, R.flip(R.append), R.concat, Task.of({Ok: Result.Ok([]), Error: Result.Error('')}), [Task.of(Result.Ok(1))), Task.of(Result.Error('a')),
 * Task.of(Result.Ok(2)), Task.of(Result.Error('b')])
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
export const mapMDeep = R.curry((monadDepth, f, monad) => {
  return doMDeep(
    monadDepth,
    // Wrapping for debugging visibility
    R.curry((fn, functor) => R.map(fn, functor)),
    f,
    monad);
});

/**
 * composeWith using mapMDeep Each function of compose will receive the object monadDepth levels deep.
 * The function should transform the value without wrapping in monads
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {*} list  List of functions that expects the unwrapped value and returns an unwrapped value
 * @returns {Object} A function expecting the input value(s), which is/are passed to the last function of list
 * The value returned by the first function of list wrapped in the monadDepth levels of monads
 */
export const composeWithMapMDeep = (monadDepth, list) => {
  // Each function, last to first, in list receives an unwrapped object and returns an unwrapped object.
  // mapMDeep is called with each of these functions. The result of each mapMDeep is given to the next function
  return R.composeWith(mapMDeep(monadDepth))(list);
};

/**
 * composeWith using map. The final function in list (first run) must return a monad that can be mapped to the
 * subsequent functions. The subsequent functions map the incoming value but do not return a monad.
 * @param {*} list  List of functions that expects the unwrapped value and returns an unwrapped value
 * @returns {Object} A function expecting the input value(s), which is/are passed to the last function of list
 */
export const composeWithMap = list => {
  return composeWithMapMDeep(1, list);
};

/**
 * Chain based on the depth of the monad
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {Function} Mapping function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped monad value
 */
export const chainMDeep = R.curry((monadDepth, f, monad) => {
  // This prevents common error types from continuing to chain to prevent a partially chained result
  // Add more as needed
  const errorPredicate = mm => R.anyPass([
    Result.Error.hasInstance
  ])(mm);
  return doMDeep(
    monadDepth,
    // Wrapping for debugging visibility
    R.curry((fn, m) => {
      // If the error predicate returns true revert to the monad for the remaining
      return R.ifElse(
        errorPredicate,
        () => monad,
        mm => R.chain(fn, mm)
      )(m);
    }),
    f,
    monad
  );
});

/**
 * chains at each level excepts maps the deepest level
 * @param monadDepth
 * @param f
 * @param monad
 * @return {*}
 */
export const chainExceptMapDeepestMDeep = R.curry((monadDepth, f, monad) => {
  return doMDeepExceptDeepest(monadDepth, [R.chain, R.map], f, monad);
});

/**
 * Map based on the depth of the monad-1 and chain the deepest level monad
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {Function} Chaining function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped then chained monad value
 */
export const mapExceptChainDeepestMDeep = R.curry((monadDepth, f, monad) => {
  return doMDeepExceptDeepest(monadDepth, [R.map, R.chain], f, monad);
});

/**
 * composeWith using chainMDeep Each function of compose will receive the object monadDepth levels deep.
 * The function should transform the value without wrapping in monads
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {*} list  List of functions that expects the unwrapped value and returns an unwrapped value
 * @returns {Object} A function expecting the input value(s), which is/are passed to the last function of list
 * The value returned by the first function of list wrapped in the monadDepth levels of monads
 */
export const composeWithChainMDeep = (monadDepth, list) => {
  // Each function, last to first, in list receives an unwrapped object and returns the monadDepth level deep monad
  // chainMDeep is called with each of these functions. The result of each chainMDeep is given to the next function
  return R.composeWith(
    (f, res) => {
      return chainMDeep(monadDepth, f, res);
    }
  )(list);
};

/**
 * Composes with chain
 * The function should transform the value without wrapping in monads
 * @param {*} list  List of functions that expects the unwrapped value and returns an unwrapped value
 * @returns {Object} A function expecting the input value(s), which is/are passed to the last function of list
 * The value returned by the first function of list wrapped in a monad
 */
export const composeWithChain = list => {
  return composeWithChainMDeep(1, list);
};

/**
 * composeWith using mapMDeep but chain the lowest level so that each function of list must return the deepest monad.
 * Each function of compose will receive the object monadDepth levels deep.
 * The last function (first called) must returned the monadDepth deep wrapped monad but subsequent ones must only
 * return a type of the deepest monad.
 * For example:
 * const test = composeWithMapExceptChainDeepestMDeep(2, [
 * // Subsequent function will only process Result.Ok
 * deliciousFruitOnly => Result.Ok(R.concat('still ', deliciousFruitOnly)),
 * // Subsequent function returns the deepest monad
 * testFruit => R.ifElse(R.contains('apple'), f => Result.Ok(R.concat('delicious ', f)), f => Result.Error(R.concat('disgusting ', f)))(testFruit),
 * // Initial function returns 2-levels deep
 * fruit => task.of(Result.Ok(R.concat('test ', fruit)))
 *])
 * test('apple') => task.of(Result.Ok('still delicious test apple'))
 * test('kumquat') => task.of(Result.Error('disgusting test kumquat'))
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {*} list  List of functions that expects the unwrapped value and returns an unwrapped value
 * @returns {Object} A function expecting the input value(s), which is/are passed to the last function of list
 * The value returned by the first function of list wrapped in the monadDepth levels of monads
 */
export const composeWithMapExceptChainDeepestMDeep = (monadDepth, list) => {
  return R.composeWith(mapExceptChainDeepestMDeep(monadDepth))(list);
};

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
 * Map/Chain/Filter etc based on the depth of the monad and the funcPair. The deepest monad is processed
 * with funcPair[1] and all higher level monads are processed with funcPair[0]. This allows for a combination
 * such as [R.map, R.chain] to chain the deepest value but map the higher values so that the caller can
 * change the deepest monad type without having to wrap the unchanging outer monad types. For instance
 * the caller might have a monad task.of(Result.Ok) and want to convert it conditionally to task.of(Result.Error):
 * const test = doMDeepExceptDeepest(2, [R.map, R.chain], R.ifElse(R.equals('pear'), Result.Error, Result.Ok)(of(result)))
 * test(of(Result.Ok('apple'))) => of(Result.Ok('apple'))
 * test(of(Result.Ok('pear'))) => of(Result.Error('pear'))
 * Note that in this example task.of doesn't have to be used again to wrap the result
 * @param {Number} monadDepth 1 or greater. [1] is 1, [[1]] is 2, Result.Ok(Maybe.Just(1)) is 2
 * @param {[Function]} funcPair Two functions R.map, R.chain, R.filter or similar.
 * The first function is composed monadDepth-1 times and the last function is composed once after the others
 * @param {Function} f Mapping function that operates at the given depth.
 * @param {Object} Monad of a least the given depth
 * @returns {Object} The mapped monad value
 */
export const doMDeepExceptDeepest = R.curry((monadDepth, funcPair, f, monad) => {
  return R.compose(
    // This composes the number of R.liftN(N) calls we need. We need one per monad level
    ...R.times(
      R.always(
        func => value => funcPair[0](func, value)
      ),
      monadDepth - 1
    ),
    // funcPair[1] gets called with the deepest level of monad
    func => value => funcPair[1](func, value)
  )(f)(monad);
});

/**
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value to return an obj with the value at 'value', merged with input object in its original form
 * of the function. Example: mapToResponseAndInputs(({a, b, c}) => task.of(someValue))({a, b, c}) -> task.of({a, b, c, value: someValue})
 * @param {Function} f Function expecting an object and returning a monad that can be mapped
 * @param {Object} arg The object containing the incoming named arguments that f is called with. If null defaults to {}.
 * @return {Object} The value of the monad at the value key merged with the input args
 */
export const mapToResponseAndInputs = f => arg => {
  return mapMonadByConfig({name: 'value'}, f)(arg);
};

/**
 * Applies f to arg returning a monad that is at least level deep. mapMDeep(level) is then used to map the value
 * of the monad at that level
 * @param {Number} level Monadic level of 1 or greater. For instance 1 would map the 'apple' of task.of('apple'),
 * 2 would map the 'apple' of task.of(Result.Ok('apple')) etc. The mapped value is merged with arg and returned
 * @param {Function} f The function applied to arg
 * @param {*} arg Argument passed to f
 * @return {Object} The monad that result from the deep mapping
 */
export const mapToMergedResponseAndInputsMDeep = (level, f) => arg => {
  return mapMonadByConfig({mappingFunction: mapMDeep(level)}, f)(arg);
};

/**
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value to return an obj merged with input object in its original form
 * of the function. Example: mapToResponseAndInputs(({a, b, c}) => task.of({d: true, e: true}))({a, b, c}) -> task.of({a, b, c, d, e})
 * @param {Function} f Function expecting an object and returning a monad that can be mapped to an object
 * @param {Object} arg The object containing the incoming named arguments that f is called with. If null defaults to {}.
 * @return {Object} The value of the monad merged with the input args
 */
export const mapToMergedResponseAndInputs = f => arg => mapToMergedResponseAndInputsMDeep(1, f)(arg);

/**
 * Given a monad whose return value can be mapped and a single input object,
 * map the monad return value to return an obj with the value at 'value', merged with input object in its original form
 * of the function. Example: mapToNamedResponseAndInputs('foo', ({a, b, c}) => task.of(someValue))({a, b, c}) -> task.of({a, b, c, foo: someValue})
 * @param {String} name The key name for the output
 * @param {Function} f Function expecting an object and returning a monad that can be mapped
 * @param {Object} arg The object containing the incoming named arguments that f is called with. If null defaults to {}.
 * @return {Object} The value of the monad at the value key merged with the input args
 */
export const mapToNamedResponseAndInputs = (name, f) => arg => {
  return mapMonadByConfig({name}, f)(arg);
};

/**
 * Given a monad the specified levels deep whose return value can be mapped and a single input object,
 * map the monad return value to return an obj with the value at 'value', merged with input object in its original form
 * of the function. Example: mapToNamedResponseAndInputs(2, 'foo', ({a, b, c}) => task.of(Result.Ok(someValue)))({a, b, c}) -> task.of(Result.Ok({a, b, c, foo: someValue}))
 * @param {String} name The key name for the output
 * @param {Function} f Function expecting an object and returning a monad that can be mapped
 * @param {Object} arg The object containing the incoming named arguments that f is called with. If null defaults to {}.
 * @return {Object} The value of the monad at the value key merged with the input args
 */
export const mapToNamedResponseAndInputsMDeep = R.curry((level, name, f, arg) => {
  return mapMonadByConfig({mappingFunction: mapMDeep(level), name}, f)(arg);
});

/**
 * Same as mapToNamedResponseAndInputs but works with a non-monad
 * @param {String} name The key name for the output
 * @param {Function} f Function expecting an object and returning an value that is directly merged with the other args
 * @param {Object} arg The object containing the incoming named arguments that f is called with. If null defaults to {}.
 * @return {Object} The output of f named named and merged with arg
 */
export const toNamedResponseAndInputs = (name, f) => arg => {
  const monadF = _arg => Just(f(_arg));
  const just = mapToNamedResponseAndInputs(name, monadF)(R.when(R.isNil, () => ({}))(arg));
  return just.unsafeGet();
};

/**
 * Hybrid version of mapToNamedResponseAndInputs and toNamedResponseAndInputs.
 * Handles mapping a monad containing an object or straight object
 * @param {String} name The name for the key of the output value
 * @param {Function} f mapping function
 * @return {*} The monad if f(_arg) is a monad, other wise an object
 */
export const mapOrObjToNamedResponseAndInputs = (name, f) => arg => {
  // Wrap in a monad unless there is a map property, meaning it's already a monad
  let isMonad = null;
  const monadF = _arg => {
    const maybeMonad = f(_arg);
    isMonad = R.hasIn('map', maybeMonad);
    // Wrap if it wasn't a monad
    return R.unless(() => isMonad, Just)(f(_arg));
  };
  const just = mapToNamedResponseAndInputs(name, monadF)(R.when(R.isNil, () => ({}))(arg));
  // Unwrap if it wasn't a monad
  return R.unless(() => isMonad, j => j.unsafeGet())(just);
};

/**
 * Same as toMergedResponseAndInputs but works with a non-monad
 * @param {Function} f Function expecting an object and returning an value that is directly merged with the other args
 * @param {Object} arg The object containing the incoming named arguments that f is called with.  If null defaults to {}.
 * @return {Object} The output of f named named and merged with arg
 */
export const toMergedResponseAndInputs = f => arg => {
  const monadF = _arg => Just(f(_arg));
  const just = mapToMergedResponseAndInputs(monadF)(arg);
  return just.unsafeGet();
};

/**
 * Internal method to place a Result instance at the key designated by resultOutputKey merged with an
 * object remainingInputObj. This is used by mapResultMonadWithOtherInputs and for task error handling by
 * mapResultTaskWithOtherInputs
 * @param {String} [resultOutputKey] The key to use for the output Result instance. If not specified,
 * The result is instead merged with the remainingInputObj
 * @param {Object} remainingInputObj Input object that does not include the resultInputKey Result
 * @param {Object} result The Result instance to output
 * @returns {Object} remainingInputObject merged with {resultOutputKey: result} or result
 * @private
 */
const _mapResultToOutputKey = (resultOutputKey, remainingInputObj, result) => R.ifElse(
  R.always(resultOutputKey),
  // Leave the remainingInputObj out
  _result => R.merge(remainingInputObj, {[resultOutputKey]: _result}),
  // If there is anything in the remainingInputObj, merge it with the result.value
  _result => R.map(R.merge(remainingInputObj), _result)
)(result);

/**
 * For mapResultMonadWithOtherInputs separates the resultInputKey value from the other input values in inputObj
 * @param {String} [resultInputKey] Key indicating a Result instance in inputObj. If null then the entire inputObj
 * is assumed to be a Result
 * @param {Object} inputObj Input object containing a Result at inputObj
 * @returns {{remainingInputObj: *, inputResult: *}|{remainingInputObj: {}, inputResult: *}}
 * remainingInputObj is inputObject without resultInputKey, inputResult is the value of resultInputKey or simply
 * inputObject if resultInputKey is not specified
 * @private
 */
const _separateResultInputFromRemaining = (resultInputKey, inputObj) => {
  if (resultInputKey) {
    // Omit resultInputKey since we need to process it separately
    return {
      remainingInputObj: R.omit([resultInputKey], inputObj),
      // inputObj[resultInputKey] must exist
      inputResult: reqStrPathThrowing(resultInputKey, inputObj)
    };
  }
  // No resultInputKey, so the the entire input is an inputObj
  return {
    remainingInputObj: {},
    inputResult: inputObj
  };
};

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
    const {remainingInputObj, inputResult} = _separateResultInputFromRemaining(resultInputKey, inputObj);

    // If our incoming Result is a Result.Error, just wrap it in the monad with the expected resultOutputKey
    // This is the same resulting structure if the f produces a Result.Error
    if (Result.Error.hasInstance(inputResult)) {
      return inputResult.orElse(
        error => monad(_mapResultToOutputKey(resultOutputKey, remainingInputObj, inputResult))
      );
    }
    return R.chain(
      value => R.compose(
        resultMonad => R.map(result => _mapResultToOutputKey(resultOutputKey, remainingInputObj, result), resultMonad),
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
 * If a task error occurs then a Result.Error is returned in a task with the error
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
    ).orElse(
      // If the task itself fails, put the error in the resultOutputKey
      error => {
        // Separate the inputResult from the other input values
        const {remainingInputObj, inputResult} = _separateResultInputFromRemaining(resultInputKey, inputObj);
        // Create a Result.Error at resultOutputKey and wrap the object in a task. This matches the successful
        // outcome but with a Result.Error
        return of((_mapResultToOutputKey(resultOutputKey, remainingInputObj, Result.Error(error))));
      }
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
  (name, strPath, f) => arg => {
    return mapMonadByConfig({name, strPath}, f)(arg);
  }
);

/**
 * A generalized form of mapToNamedPathAndInputs and mapToNamedResponse
 * @param {Object} config The configuration
 * @param {Function} [config.mappingFunction]. Defaults to R.map, the mapping function to use to map the monad
 * returned by f(arg). For example R.mapMDeep(2) to map 2-level monad
 * @param {String} [config.name] The name to assign the result of applying the monadic function f to arg. This
 * name/value is merged with the incoming object arg. If omitted
 * @param {String} [config.strPath] Optional string path to extract a value with the value that the monad that f(arg) returns
 * @param {Function} [config.isMonadType] Optionaly accepts f(arg) and tests if it matches the desired monad, such
 * as task.of, Result.of, Array.of. Returns true or false accordingly
 * f(arg).
 * @param {Function} [config.errorMonad] Optional. If the monad returned by f(arg) doesn't match the monad,
 * then the errorMonad is returned containing an {f, arg, value, message} where value is the return value and message
 * is an error message. If config.successMonad isn't specified, this value is used if the the return value of f(arg)
 * lacks a .map function
 * @param {Function} f The monadic function to apply to arg
 * @param {Object} arg The argument to pass to f. No that this argument must be called on the result of such as:
 * mapMonadByConfig(config, f)(arg)
 * @return {Object} The monad or error monad value or throws
 */
export const mapMonadByConfig = (
  {mappingFunction, name, strPath, isMonadType, errorMonad},
  f
) => arg => {
  return R.defaultTo(R.map, mappingFunction)(
    // Container value
    value => {
      // If name is not specified, value must be an object
      // If strPath is specified, value must be an object
      if (R.both(
        v => R.not(R.is(Object, v)),
        () => {
          return R.either(
            ({name: n}) => R.isNil(n),
            ({strPath: s}) => s
          )({name, strPath});
        }
      )(value)) {
        let message;
        message = `value ${inspect(value)} is not an object. arg: ${inspect(arg)}, f: ${f}`;
        if (errorMonad) {
          // return the errorMonad if defined
          return errorMonad({f, arg, value, message});
        }
        throw new Error(message);
      }
      // Merge the current args with the value object, or the value at name,
      // first optionally extracting what is at strPath
      const resolvedValue = R.when(
        () => strPath,
        v => {
          try {
            return reqStrPathThrowing(strPath, v);
          } catch (e) {
            console.error(`Function ${f} did not produce a value at ${strPath}`); // eslint-disable-line no-console
            throw e;
          }
        }
      )(value);
      return R.merge(
        arg,
        R.when(
          () => name,
          v => {
            return {[name]: v};
          }
        )(resolvedValue)
      );
    },
    // Call f(arg), raising an exception if it doesn't return a monad
    applyMonadicFunction({isMonadType, errorMonad}, f, arg)
  );
};

/**
 *
 * @param {Object} config The configuration
 * @param {Function} [config.isMonadType] if specified the result of f(arg) is applied to it to see if f(arg) returns
 * the right type. Returns a boolean
 * @param {Object} [config.errorMonad] if f(arg) doesn't match the type of config.successMonad or if config.successMonad
 * is not specified but the returned value of f(arg) lacks a map method, this type is called with the given values:
 * {f, arg, value, message} where value is the return value of f(arg) and message is an error message
 * @param {Function} f Expects a single argument and returns a monad
 * @param {*} arg The argument. If this is mistakenly null it will be made {}
 * @return {*} The monad
 */
export const applyMonadicFunction = ({isMonadType, errorMonad}, f, arg) => {
  return R.unless(
    value => R.both(
      v => R.is(Object, v),
      v => R.ifElse(
        () => isMonadType,
        // If successMonad is specified check that the value matches its type
        vv => isMonadType(vv),
        // Otherwise just check that it has a map function
        vv => R.hasIn('map', vv)
      )(v)
    )(value),
    value => {
      const message = `mapToNamedPathAndInputs: function f with args: ${
        inspect(arg)
      } returned value ${
        inspect(value)
      }, which lacks a .map() function, meaning it is not a monad. Make sure the return value is the desired monad type: task, array, etc`;

      if (errorMonad) {
        return errorMonad({f, arg, value, message});
      }
      throw new TypeError(message);
    }
    // Default arg to {} if null
  )(f(R.when(R.isNil, () => ({}))(arg)));
};


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
 * Calls a function with arg that returns a monad and maps the result to the given string path.
 * The input values are not returned, just the mapped value
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
    // Call f(arg), raising an exception if it doesn't return a monad
    applyMonadicFunction({}, f, arg)
  )
);

/**
 * Versions of task.waitAll that divides tasks into 100 buckets to prevent stack overflow since waitAll
 * chains all tasks together
 * @param {Task} tasks A list of tasks
 * @param {Number} [buckets] Default to 100. If there are 1 million tasks we probably need 100,000 buckets to
 * keep stacks to 100 lines
 * @returns {*} The list of tasks to be processed without blowing the stack limit
 */
export const waitAllBucketed = (tasks, buckets = 100) => {
  const taskSets = R.reduceBy(
    (acc, [tsk, i]) => R.concat(acc, [tsk]),
    [],
    ([_, i]) => i.toString(),
    R.addIndex(R.map)((tsk, i) => [tsk, i % buckets], tasks)
  );

  return R.map(
    // Chain the resultSets together
    // Task t:: t[[a]] -> t[a]
    resultSets => R.chain(R.identity, resultSets),
    // Task t:: [t[a]] -> t[[a]]
    R.traverse(
      of,
      // Do a normal waitAll for each bucket of tasks
      // to run them all in parallel
      // Task t:: [t] -> t [a]
      R.ifElse(
        // If we have more than 100 buckets recurse on a tenth
        ts => R.compose(R.lt(100), R.length)(ts),
        ts => waitAllBucketed(ts, buckets / 10),
        ts => waitAll(ts)
      ),
      // Remove the bucket keys
      // Task t:: <k, [t]> -> [[t]]
      R.values(taskSets)
    )
  );
};

/**
 *
 * Buckets the given monads into bucketCount number buckets
 * @param {Number} bucketSize The number of moands in each bucket
 * @param {[Object]} monads The monads to bucket
 * @return {[[Object]]} Lists of monads
 */
const bucketedMonadSets = (bucketSize, monads) => {
  return R.compose(
    // Remove the keys
    R.values,
    ms => {
      return R.reduceBy(
        (acc, [mms, i]) => R.concat(acc, [mms]),
        [],
        ([_, i]) => i.toString(),
        // Create pairs where the second value is the index / bucketCount
        // This lets us dived the first bucketCount monads into once bucket, the next bucketCounts into the next
        // bucket, etc
        R.addIndex(R.map)((monad, monadIndex) => {
          return [monad, Math.floor(monadIndex / bucketSize)];
        }, ms)
      );
    }
  )(monads);
};
/**
 * Versions of R.sequence that divides tasks into 100 buckets to prevent stack overflow since waitAll
 * chains all tasks together. waitAllSequentiallyBucketed runs tasks sequentially not concurrently
 * @param {Object} config The configuration
 * @param {Number} [config.buckets] Default to R.length(monads) / 100 The number of buckets to divide monads into
 * @param {Object} [config.monadType] The monad type to pass to R.traverse. E.g. Task.of, Result.Ok, Maybe.Just
 * @param {[Object]} monads A list of monads
 * @returns {*} The list of monads to be processed without blowing the stack limit
 */
export const sequenceBucketed = ({buckets, monadType}, monads) => {
  const bucketSize = buckets || Math.floor(R.length(monads) / 100);
  const monadSets = bucketedMonadSets(bucketSize, monads);
  if (!monadType) {
    throw new Error('config.monadType is not specified. It is required for sequencing');
  }

  return R.map(
    // Chain the resultSets together
    // Monad m:: m[[a]] -> m[a]
    resultSets => R.chain(R.identity, resultSets),
    // Process each set of monads with R.sequence (end case) or recurse with sequenceBucket with smaller bucket size
    // Monad m:: [m[a]] -> m[[a]]
    R.traverse(
      monadType,
      // Monad m:: [m] -> m [a]
      R.ifElse(
        // If we have more than 100 monads recurse, limiting the bucket size to 1 / 10 the current bucket size
        m => R.compose(R.lt(100), R.length)(m),
        m => sequenceBucketed({monadType, buckets: bucketSize / 10}, m),
        // Do a normal R.sequence for each bucket of monads
        // to run them all in sequence
        m => R.sequence(monadType, m)
      ),
      monadSets
    )
  );
};

// given an array of something and a transform function that takes an item from
// the array and turns it into a task, run all the tasks in sequence.
// inSequence :: (a -> Task) -> Array<a> -> Task
/* export const chainInSequence = R.curry((chainedTasks, task) => {
  let log = [];

  R.chain(
    reducedValue => task
  chainedTasks;
)

  return items.reduce((pipe, item, i) => {
    // build up a chain of tasks
    return (
      pipe
        // transform this item to a task
        .chain(() => transform(item))
        // after it's done, push the result to and return the log
        .map(result => {
          log.push(result);
          return log;
        })
    );
  }, Task.of("start"));
})*/

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

/**
 * Converts a list of result tasks to a single task containing {Ok: objects, Error: objects}
 * @param {[Task<Result<Object>>]} resultTasks List of Tasks resolving to a Result.Ok or Result.Error
 * @return {Task<Object>} The Task that resolves to {Ok: objects, Error: objects}
 */
export const resultTasksToResultObjTask = resultTasks => {
  return traverseReduceWhileBucketedTasks(
    {predicate: R.always(true)},
    // The accumulator
    ({Ok: oks, Error: errors}, result) => {
      return result.matchWith({
        Ok: ({value}) => {
          return {Ok: R.concat(oks, [value]), Error: errors};
        },
        Error: ({value}) => {
          return {Ok: oks, Error: R.concat(errors, [value])};
        }
      });
    },
    of({Ok: [], Error: []}),
    resultTasks
  );
};

/**
 * Converts a list of results to a single result containing {Ok: objects, Error: objects}
 * @param {[Result<Object>]} results List of Tasks resolving to a Result.Ok or Result.Error
 * @return {Object} The Task that resolves to {Ok: objects, Error: objects}
 */
export const resultsToResultObj = results => {
  return traverseReduceDeepResults(1,
    // The accumulator
    (res, location) => R.concat(
      res,
      [location]
    ),
    // The accumulator of errors
    (res, errorObj) => R.concat(
      res,
      [errorObj]
    ),
    {Ok: [], Error: []},
    results
  );
};

/**
 * Run the given task the given number of times until it succeeds. If after the give times it still rejects then
 * reject with the accumulated errors of each failed run
 * @param {Object} tsk Task to run multiply times
 * @param {Number} times The number of times to run the tasks
 * @param {[Object]} [errors] Optional place to push errors
 * @return {Task <Object>} Returns a task that resolves task or rejects
 */
export const retryTask = (tsk, times, errors) => {
  const errs = errors || [];
  const _retryTask = _times => {
    return tsk.orElse(reason => {
      errs.push(reason);
      if (_times > 1) {
        return _retryTask(_times - 1);
      }
      return rejected(`Task failed after ${_times} tries ${
        R.join('\n', R.map(error => stringifyError(error), errs))
      }`);
    });
  };
  return _retryTask(times);
};

