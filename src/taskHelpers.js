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

/**
 * Default handler for Task rejections when an error is unexpected and should halt execution
 * with a useful stack and message
 * @param {*} reject Rejection value from a Task
 */
export const onRejected = reject => {
  throw(reject);
};
export const onCancelled = () => {
  console.log('The task was cancelled. This is the default action');
};

/**
 * Defaults the onRejected and onCancelled handler and pass. Pass the onResolved function
 * with the key onResolved
 * @param {Function} onResolved Unary function expecting the resolved value
 * @retunrs {Object} Run config with onCancelled, onRejected, and onReolved handlers
 */
export const defaultRunConfig = ({onResolved}) => ({
  onCancelled,
  onRejected,
  onResolved
});