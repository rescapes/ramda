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

import {task as folktask, of, fromPromised} from 'folktale/concurrency/task';
import {
  defaultRunConfig, objOfApplicativesToListOfApplicatives, promiseToTask, resultToTask,
  taskToPromise
} from './taskHelpers';
import * as R from 'ramda';
import * as Result from 'folktale/result';
import * as Maybe from 'folktale/maybe';
import {defaultRunToResultConfig} from './taskHelpers';


describe('taskHelpers', () => {
  test('Should convert Task to Promise', async () => {
    await expect(taskToPromise(folktask(
      resolver => resolver.resolve('donut')
    ))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(taskToPromise(folktask(resolver => resolver.reject(err)))).rejects.toBe(err);
  });

  test('Should convert Promise to Task', async () => {
    await expect(taskToPromise(promiseToTask(new Promise(function (resolve, reject) {
      resolve('donut');
    })))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(taskToPromise(promiseToTask(new Promise(function (resolve, reject) {
      reject(err);
    }), true))).rejects.toBe(err);
    // What if a chained task rejects
    await expect(taskToPromise(R.composeK(
      value => folktask(resolver => resolver.reject('2 2 1 1 2')),
      value => folktask(resolver => resolver.reject('1 1 1 race')),
      value => folktask(resolver => resolver.reject('was 1 2')),
      value => of('was a race horse')
    )('1 1'))).rejects.toEqual('was 1 2');
  });

  test('defaultRunConfig Resolved', done => {
    folktask(resolver => resolver.resolve('Re solved!')).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('Re solved!');
          done();
        }
      })
    );
  });

  test('defaultRunConfig Throws', () => {
    expect(
      () => folktask(resolver => {
        throw new Error('Oh noo!!!');
      }).run().listen(
        defaultRunConfig({
          onResolved: resolve => {
            throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
          }
        })
      )
    ).toThrow();
  });

  test('defaultRunToResultConfig Resolved', done => {
    folktask(resolver => resolver.resolve(Result.Ok('Re solved!'))).run().listen(
      defaultRunToResultConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('Re solved!');
          done();
        }
      })
    );
  });

  test('defaultRunResultConfig Throws', () => {
    expect(
      () => folktask(resolver => {
        // Result.Error should result in onRejected being called, which throws
        resolver.resolve(Result.Error('Oh noo!!!'));
      }).run().listen(
        defaultRunToResultConfig({
          onResolved: resolve => {
            throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
          }
        })
      )
    ).toThrow();
  });

  test('composeK with new Tasks (technology test)', done => {
    R.composeK(
      v => of(`${v} racehorse`),
      v => of(`${v} a`),
      v => of(`${v} was`),
      v => of(`${v} 1`)
    )(1).run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual(
          '1 1 was a racehorse'
        );
        done();
      }
    });
  });

  test('composeK with new Tasks and error (technology test)', done => {
    R.composeK(
      v => of('I never get called :<'),
      v => folktask(resolver => resolver.reject(`${v} Oh no!`)),
      v => of(`${v} a`),
      v => of(`${v} was`),
      v => of(`${v} 1`)
    )(1).run().listen({
      onRejected: reject => {
        expect(reject).toEqual(
          '1 1 was a Oh no!'
        );
        done();
      },
      onResolved: result => {
        throw(new Error(result));
      }
    });
  });

  test('fromPromised (technology test)', done => {
    // fromPromised works on an n-arity function that returns a promise
    const task = fromPromised(receive => Promise.resolve(`shellac${receive}`))('ing');
    task.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual(
          'shellacing'
        );
        done();
      }
    });
  });

  test('resultToTask', done => {
    resultToTask(Result.Ok(1)).run().listen(defaultRunConfig(
      {
        onResolved: response => {
          expect(response).toEqual(1);
          done();
        }
      }
    ));
  });
  test('resultToTaskError', done => {
    resultToTask(Result.Error(1)).run().listen({
      onRejected: response => {
        expect(response).toEqual(1);
        done();
      }
    });
  });

  test('objOfApplicativesToListOfApplicatives', done => {
    R.sequence(of, objOfApplicativesToListOfApplicatives(of, null, {a: of(1), b: of(2)})).run().listen({
      onResolved: response => {
        expect(response).toEqual([['a', 1], ['b', 2]]);
        done();
      }
    });
  });

  test('objOfApplicativesToListOfApplicativesWithComplexAp', done => {
    R.sequence(
      of,
      objOfApplicativesToListOfApplicatives(
        // Each item of the list is a Task<Result>, so use a matching constructor
        R.compose(of, Result.Ok),
        // Use an apChainer to chain the task to it's underlying result and then map the result to a f, which appends
        // the key to the value of result to make a pair
        (f, tsk) => R.chain(result => R.chain(f, result), tsk),
        {a: of(Result.Ok(1)), b: of(Result.Ok(2))})
    ).run().listen({
      onResolved: response => {
        expect(response).toEqual([['a', Result.Ok(1)], ['b', Result.Ok(2)]]);
        done();
      }
    });
  });

  test('chaining', () => {

    // Map a Result an map a Maybe
    expect(
      R.map(
        maybe => R.map(v => 2, maybe),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result
    expect(
      R.chain(
        maybe => Result.Ok(Maybe.Just(2)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result an map a Maybe
    expect(
      R.chain(
        maybe => Result.Ok(R.map(v => 2, maybe)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result and Chain a Maybe
    expect(
      R.chain(
        maybe => Result.Ok(R.chain(v => Maybe.Just(2), maybe)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));


    // Map a Result and Chain a Maybe
    expect(
      R.map(
        maybe => R.chain(v => Maybe.Just(2), maybe),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result and Chain a Maybe Differently
    const constructor = x => R.compose(Result.Ok, Maybe.Just)(x+1);
    expect(
      R.chain(R.chain(constructor))(Result.Ok(Maybe.Just(1)))
    ).toEqual(Result.Ok(Maybe.Just(2)));
  });
});
