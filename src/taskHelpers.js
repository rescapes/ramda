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


import {task as folktask} from 'folktale/concurrency/task';

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
 * For a task that returns an Either.
 * Defaults the onRejected and onCancelled to throw or log, respectively, when neither is expected to occur.
 * Pass the onResolved function with the key onResolved pointing to a unary function with the result.
 * If the task resolves to an Either.Right, resolves the underlying value and passes it to the onResolved function
 * that you define. If the task resolves ot an Either.Left, the underlying value is passed to on Rejected.
 * rejection and cancellation resolves the underlying value of the Right or Left. In practice onRejected shouldn't
 * get called directly. Rather a Left should be resolved and then this function calls onRejected. cancellation
 * should probably ignores the value
 * Example:
 * task.listen().run(defaultRunConfig({
 *  onResolved: value => ... do something with value ...
 * }))
 * @param {Function} onResolved Unary function expecting the resolved value
 * @returns {Object} Run config with onCancelled, onRejected, and onReolved handlers
 */
export const defaultRunToEitherConfig = ({onResolved}) => ({
  onCancelled,
  onRejected: either => either.map(onRejected).leftMap(onRejected),
  // resolve either.Right, reject either.Left
  onResolved: either => either.map(onResolved).leftMap(onRejected)
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
