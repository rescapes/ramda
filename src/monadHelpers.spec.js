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

import {of, rejected, fromPromised, task, waitAll} from 'folktale/concurrency/task';
import {
  defaultRunConfig,
  lift1stOf2ForMDeepMonad,
  objOfMLevelDeepListOfMonadsToListWithPairs,
  objOfMLevelDeepMonadsToListWithPairs,
  pairsOfMLevelDeepListOfMonadsToListWithPairs,
  promiseToTask,
  resultToTask,
  taskToPromise,
  defaultRunToResultConfig,
  traverseReduce,
  traverseReduceWhile,
  traverseReduceDeep,
  resultToTaskNeedingResult,
  mapMDeep,
  resultToTaskWithResult,
  traverseReduceDeepResults,
  chainMDeep,
  mapToResponseAndInputs,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  defaultOnRejected,
  mapResultMonadWithOtherInputs,
  mapResultTaskWithOtherInputs,
  mapWithArgToPath,
  mapToPath,
  taskToResultTask,
  toNamedResponseAndInputs,
  waitAllBucketed,
  sequenceBucketed, traverseReduceError, traverseReduceResultError
} from './monadHelpers';
import * as R from 'ramda';
import * as Result from 'folktale/result';
import * as Maybe from 'folktale/maybe';
import * as f from './functions';


describe('monadHelpers', () => {
  // Demonstrates accumulating errors with defaultRunConfig
  test('defaultRunConfig', done => {
    let errors = [];
    const tummy = new Error('Tummy');
    const t = of(5).chain(
      () => task(resolver => {
        // Our task detects an errors and pushes it, then rejecteds another error
        errors.push(new Error('Ache'));
        resolver.reject(tummy);
      })
    ).orElse(reason => {
      // Our task reject handler takes the reason and pushes it too, then rejects again
      errors.push(reason);
      // This reason is the error that goes to defaultOnRejected
      return rejected(reason);
    });
    t.run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
        },
        onRejected: (errs, error) => {
          // Wrap the default defaultOnRejected with an expect.toThrow
          expect(() => defaultOnRejected(errs, error)).toThrow();
        }
      }, errors, done)
    );
  });

  // Demonstrates test error handling using async function and promise
  test('folktale simple test error handling', async () => {
    let errors = [];
    const tummy = new Error('Tummy');
    try {
      const t = rejected(tummy).orElse(reason => {
        errors.push(reason);
        return rejected(reason);
      });
      await t.run().promise();
    } catch (e) {
      expect(e).toEqual(tummy);
    } finally {
      expect(errors).toEqual([tummy]);
    }
  });

  test('folktale error handling', async done => {
    //  https://folktale.origamitower.com/api/v2.1.0/en/folktale.concurrency.task.html
    let errors = [];
    const retry = (tsk, times) => {
      return tsk.orElse(reason => {
        errors.push(reason);
        if (times > 1) {
          return retry(tsk, times - 1);
        }
        return rejected('I give up');
      });
    };

    let runs = 0;
    const ohNoes = task(r => {
      runs = runs + 1;
      r.reject('fail');
    });

    try {
      const result2 = await retry(ohNoes, 3).run().promise();
      throw new Error('never happens');
    } catch (error) {
      try {
        expect(runs).toEqual(3);
        expect(errors).toEqual(['fail', 'fail', 'fail']);
        expect(error).toEqual('I give up');
      } catch (e) {
        // console.log('Error in catch', e);
      }
    } finally {
      done();
    }
  });

  test('defaultRunConfig Resolved', done => {
    task(resolver => resolver.resolve('Re solved!')).run().listen(
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
      () => task(resolver => {
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
    task(resolver => resolver.resolve(Result.Ok('Re solved!'))).run().listen(
      defaultRunToResultConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('Re solved!');
          done();
        }
      })
    );
  });

  test('defaultRunToResultConfig Throws', done => {
    let errors = [];
    expect(
      () => task(resolver => {
        // Result.Error should result in defaultOnRejected being called, which throws
        errors.push(new Error('Expect this warning about some bad Result'));
        resolver.resolve(Result.Error('Oh noo!!!'));
      }).run().listen(
        defaultRunToResultConfig({
          onResolved: resolve => {
            throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
          }
        }, errors, done)
      )
    ).toThrow();
  });


  test('defaultRunToRebsultConfig pending deferred problem', done => {
    const delay = (timeout, result, isError = false) => task(resolver =>
      setTimeout(() => {
        // This prevents the pending deferred message the when task c rejects after task b's rejection has cancelled
        // the whole waitAll
        if (resolver.isCancelled) {
          return;
        }
        if (isError) {
          resolver.reject(result);
        } else {
          resolver.resolve(result);
        }
      }, timeout)
    );
    // https://github.com/origamitower/folktale/issues/153
    const tsk = waitAll([delay(50, 'a'), delay(20, 'b', true), delay(30, 'c', true)])
      .orElse(e => rejected(console.log('Error: ', e))); // eslint-disable-line no-console

    tsk.run().listen(
      {
        onResolved: v => {
          done();
        },
        onRejected: e => {
          // Finish after all three tasks have run
          setTimeout(() => {
            done();
          }, 100);
        }
      }
    );
  });

  test('Should convert Task to Promise', async () => {
    await expect(taskToPromise(task(
      resolver => resolver.resolve('donut')
    ))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(taskToPromise(task(resolver => resolver.reject(err)))).rejects.toBe(err);
  });

  test('Should convert Task to Result.Ok Task', done => {
    const errors = [];
    taskToResultTask(
      task(
        resolver => resolver.resolve('donut')
      )
    ).run().listen(defaultRunToResultConfig({
        onResolved: v => expect(v).toEqual('donut')
      }, errors, done)
    );
  });

  test('Should convert rejecting Task to resolved Result.Error Task', done => {
    const errors = [];
    const err = new Error('octopus');
    taskToResultTask(
      task(
        resolver => resolver.reject(err)
      )
    ).run().listen(defaultRunConfig({
        onResolved: result => result.mapError(v => expect(v).toEqual(err))
      }, errors, done)
    );
  });

  test('Should convert Task rejecting with a Result.Ok to resolved Result.Error Task', done => {
    const errors = [];
    const err = new Error('octopus');
    taskToResultTask(
      task(
        resolver => resolver.reject(Result.Ok(err))
      )
    ).run().listen(defaultRunConfig({
        onResolved: result => result.mapError(v => expect(v).toEqual(err))
      }, errors, done)
    );
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
      value => task(resolver => resolver.reject('2 2 1 1 2')),
      value => task(resolver => resolver.reject('1 1 1 race')),
      value => task(resolver => resolver.reject('was 1 2')),
      value => of('was a race horse')
    )('1 1'))).rejects.toEqual('was 1 2');
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
      v => task(resolver => resolver.reject(`${v} Oh no!`)),
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
    const t = fromPromised(receive => Promise.resolve(`shellac${receive}`))('ing');
    t.run().listen({
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

  test('resultToTaskNeedingResult', done => {
    // Result.Ok is passed to f, which returns a Task
    resultToTaskNeedingResult(v => of(v + 1), Result.Ok(1)).run().listen(defaultRunConfig(
      {
        onResolved: result => result.map(value => {
          expect(value).toEqual(2);
          done();
        })
      }
    ));

    // Result.Error goes straight to a Task.of
    resultToTaskNeedingResult(v => of(v + 1), Result.Error(1)).run().listen(defaultRunConfig(
      {
        onResolved: result => result.mapError(value => {
          expect(value).toEqual(1);
          done();
        })
      }
    ));

    // If something goes wrong in the task. The value is put in a Result.Error
    // I'm not sure if this is good practice, but there's no reason to have a valid Result in a rejected Task
    resultToTaskNeedingResult(v => rejected(v), Result.Ok(1)).run().listen({
        onRejected: result => result.mapError(value => {
          expect(value).toEqual(1);
          done();
        }),
        onResolved: result => expect('This should not ').toEqual('happen')
      }
    );
  });

  test('resultToTaskWithResult', done => {
    const errors = [];
    // Result.Ok is passed to f, which returns a Task
    resultToTaskWithResult(
      v => of(Result.Ok(v + 1)),
      Result.Ok(1)
    ).run().listen(defaultRunConfig(
      {
        onResolved: result => result.map(value => {
          expect(value).toEqual(2);
        })
      },
      errors,
      done
    ));

    // Result.Error goes straight to a Task.of
    resultToTaskWithResult(
      // This is never called
      v => of(Result.Ok(v + 1)),
      // Error
      Result.Error(1)
    ).run().listen(defaultRunConfig(
      {
        onResolved: result => result.mapError(value => {
          expect(value).toEqual(1);
        })
      },
      errors,
      done
    ));

    // If something goes wrong in the task. The value is put in a Result.Error
    // I'm not sure if this is good practice, but there's no reason to have a valid Result in a rejected Task
    resultToTaskWithResult(
      v => rejected(Result.Ok(v)),
      Result.Ok(1)
    ).run().listen({
        onRejected: result => result.mapError(value => {
          expect(value).toEqual(1);
          done();
        }),
        onResolved: result => expect('This should not ').toEqual('happen')
      }
    );

    // If something goes wrong in the task and the rejection doesn't produce a Result.Error, the rejected
    // value should get wrapped in a Resuilt.Error by resultToTaskWithResult
    // I'm not sure if this is good practice, but there's no reason to have a valid Result in a rejected Task
    resultToTaskWithResult(
      v => rejected('Something terrible happened!'),
      Result.Ok(1)
    ).run().listen({
        onRejected: result => result.mapError(value => {
          expect(value).toEqual('Something terrible happened!');
          done();
        }),
        onResolved: result => expect('This should not ').toEqual('happen')
      }
    );
  });

  const merge = (res, [k, v]) => R.merge(res, {[k]: v});
  const initialValue = apConstructor => apConstructor({});

  // Convert dict into list of Container([k,v]) because ramda's reduce doesn't support non-lists
  const objOfApplicativesToApplicative = R.curry((apConstructor, objOfApplicatives) => f.mapObjToValues(
    (v, k) => {
      return v.chain(val => apConstructor([k, val]));
    },
    objOfApplicatives
  ));

  test('traverseReduce', (done) => {
    const initialResult = initialValue(Result.of);

    expect(
      traverseReduce(
        merge,
        initialResult,
        objOfApplicativesToApplicative(Result.of, {a: Result.of('a'), b: Result.of('b')})
      )
    ).toEqual(
      Result.of({a: 'a', b: 'b'})
    );

    const mapper = objOfApplicativesToApplicative(of);
    const initialTask = initialValue(of);
    // More complicated
    const t = R.composeK(
      // returns a single Task
      letterToApplicative => traverseReduce(merge, initialTask, mapper(letterToApplicative)),
      values =>
        // wrap in task of to support composeK
        of(
          R.map(
            // First reduce each letter value to get
            //  {
            //  a: Task({apple: Result.of('apple'), aardvark: Result.of('aardvark')}),
            //  b: Task({banana: Result.of('banana'), bonobo: Result.of('bonobo')})
            //  }
            v => traverseReduce(
              merge,
              initialTask,
              mapper(v)
            ),
            values
          )
        )
    )(
      {
        a: {apple: of('apple'), aardvark: of('aardvark')},
        b: {banana: of('banana'), bonobo: of('bonobo')}
      }
    );
    t.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual({
          a: {apple: 'apple', aardvark: 'aardvark'},
          b: {banana: 'banana', bonobo: 'bonobo'}
        });
        done();
      }
    });
  });


  test('traverseReduceDeep', () => {
    const level2Constructor = R.compose(Result.Ok, Maybe.Just);

    expect(
      traverseReduceDeep(
        2,
        R.add,
        level2Constructor(0),
        R.map(level2Constructor, [1, 2, 3])
      )
    ).toEqual(
      Result.of(Maybe.Just(6))
    );

    const level3Constructor = R.compose(Result.Ok, Maybe.Just, Array.of);

    expect(
      traverseReduceDeep(
        3,
        R.divide,
        level3Constructor(1000),
        [
          // We ap R.divide(1000) with this container, meaning we call R.map(R.divide(2), [10,100,1000])
          // this yields the reduction [100, 10, 1]
          level3Constructor(10, 100, 1000),
          // Now this iteration results in the operation
          // R.ap([R.divide(10), R.multiply(100), R.multiply(1000)], [1, 2, 4]);
          // Ramda's ap function applies [1, 2, 4] to each function
          // to yield [100 / 1, 100 / 2, 100 / 4, 10 / 1, 10 / 2, 10 / 4, 1 / 1, 1 / 2, 1 / 4]
          level3Constructor(1, 2, 4)
        ]
      )
    ).toEqual(
      Result.of(Maybe.Just([100 / 1, 100 / 2, 100 / 4, 10 / 1, 10 / 2, 10 / 4, 1 / 1, 1 / 2, 1 / 4]))
    );

    // Operating on a 3 deep container at level 2
    // Even though our container is like above, we only lift twice so we can concat the two arrays
    // We aren't lifting to operate on each array item
    expect(
      traverseReduceDeep(
        2,
        R.concat,
        level3Constructor(),
        [
          level3Constructor(10, 100, 1000),
          level3Constructor(1, 2, 4)
        ]
      )
    ).toEqual(
      Result.of(Maybe.Just([10, 100, 1000, 1, 2, 4]))
    );
  });

  test('traverseReduceDeepResults', () => {
    const level1ConstructorOk = Result.Ok;
    const level1ConstructorError = Result.Error;
    const level2ConstructorOk = R.compose(Maybe.Just, Result.Ok);
    const level2ConstructorError = R.compose(Maybe.Just, Result.Error);

    expect(
      traverseReduceDeepResults(
        1,
        R.add,
        R.add,
        {Ok: 0, Error: 0},
        [level1ConstructorOk(1), level1ConstructorError(2), level1ConstructorOk(3)]
      )
    ).toEqual(
      {Ok: 4, Error: 2}
    );

    expect(
      traverseReduceDeepResults(
        2,
        R.add,
        R.add,
        Maybe.Just({Ok: 0, Error: 0}),
        [level2ConstructorOk(1), level2ConstructorError(2), level2ConstructorOk(3)]
      )
    ).toEqual(
      Maybe.Just({Ok: 4, Error: 2})
    );

    const level3ConstructorOk = R.compose(Maybe.Just, Maybe.Just, Result.Ok);
    const level3ConstructorError = R.compose(Maybe.Just, Maybe.Just, Result.Error);

    expect(
      traverseReduceDeepResults(
        3,
        R.add,
        R.add,
        Maybe.Just(Maybe.Just({Ok: 0, Error: 0})),
        [level3ConstructorOk(1), level3ConstructorError(2), level3ConstructorOk(3)]
      )
    ).toEqual(
      Maybe.Just(Maybe.Just({Ok: 4, Error: 2}))
    );
  });


  test('traverseReduceTaskWhile', done => {
    expect.assertions(1);
    const initialTask = initialValue(of);
    const t = traverseReduceWhile(
      // Make sure we accumulate up to b but don't run c
      {
        predicate: (accumulated, applicative) => R.not(R.equals('b', applicative[0])),
        accumulateAfterPredicateFail: true
      },
      merge,
      initialTask,
      objOfApplicativesToApplicative(of, {
        a: of('a'), b: of('b'), c: of('c'), d: of('d')
      })
    );
    t.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual({a: 'a', b: 'b'});
        done();
      }
    });
  });

  test('traverseReduceResultWhile', done => {
    const initialResult = initialValue(Result.of);
    traverseReduceWhile(
      // Predicate should be false when we have a b accumulated
      (accumulated, applicative) => R.not(R.prop('b', accumulated)),
      merge,
      initialResult,
      objOfApplicativesToApplicative(Result.of, {
        a: Result.of('a'),
        b: Result.of('b'),
        c: Result.of('c'),
        d: Result.of('d')
      })
    ).map(result => {
        expect(result).toEqual({a: 'a', b: 'b'});
        done();
      }
    );
  });

  test('traverseReduceTaskWithResultWhile', done => {
    // This isn't actually a deep traverse. It processes the Results in the accumulator function
    // In the future we should create a traverseReduceDeepWhile function
    const t = traverseReduceWhile(
      // Make sure we accumulate up to b but don't run c
      {
        predicate: (accumulated, applicative) => R.not(R.equals('b', applicative.unsafeGet())),
        accumulateAfterPredicateFail: true
      },
      (prevResult, currentResult) => prevResult.chain(prev => currentResult.map(current => R.append(current, prev))),
      R.compose(of, Result.Ok)([]),
      [of(Result.Ok('a')),
        of(Result.Ok('b')),
        of(Result.Ok('c')),
        of(Result.Ok('d'))
      ]
    );
    t.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual(Result.Ok(['a', 'b']));
        done();
      }
    });
  });


  test('lift1stOf2ForMDeepMonad', () => {
    // a -> Result a
    const resultConstructor = Result.Ok;
    // This is what lift2For1DeepMonad is doing:
    // To apply a 1-level monad to the same type of 1-level monad
    const lifterFor1LevelDeep = R.liftN(2, R.add)(resultConstructor(5));
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    expect(lifterFor1LevelDeep(resultConstructor(1))).toEqual(resultConstructor(6));

    // Now use lift1stOf2ForMDeepMonad
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    const myLittleResulAdder = lift1stOf2ForMDeepMonad(1, resultConstructor, R.add);
    expect(myLittleResulAdder(5)(resultConstructor(1))).toEqual(resultConstructor(6));
    expect(myLittleResulAdder(6)(resultConstructor(1))).toEqual(resultConstructor(7));

    // a -> Result (Just a)
    const resultOfMaybeConstructor = R.compose(Result.Ok, Maybe.Just);

    // This is what lift2For2DeepMonad is doing:
    // To apply an 2-level monad to the same type of 2-level monad, we must lift twice
    // This performs to maps of the monad to get at the underlying value
    // Result (Just (a)) -> Result (Just b)
    const lifterFor2LevelDeep = R.liftN(2, R.liftN(2, R.add))(resultOfMaybeConstructor(5));
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    expect(lifterFor2LevelDeep(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(6));

    // Now use lift1stOf2ForMDeepMonad
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    const myLittleResultWithMaybeAdder = lift1stOf2ForMDeepMonad(2, resultOfMaybeConstructor, R.add);
    expect(myLittleResultWithMaybeAdder(5)(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(6));
    expect(myLittleResultWithMaybeAdder(6)(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(7));
  });

  test('lift1stOf2ForMDeepMonadWithLists', () => {
    // [a] -> Just [[a]]
    // We have to wrap the incoming array so that we apply concat to two 2D arrays
    // Otherwise when we step into the 2nd monad, and array, we'll be mapping over individual elements, as below
    const maybeOfListConstructor = R.compose(Maybe.Just, a => [a]);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Just (f (a))
    const myLittleMaybeListConcatter = lift1stOf2ForMDeepMonad(2, maybeOfListConstructor, R.concat);
    expect(myLittleMaybeListConcatter(['a'])(
      maybeOfListConstructor(['b', 'c', 'd'])
    )).toEqual(maybeOfListConstructor(['a', 'b', 'c', 'd']));

    // The same as above, but just operating on Just, so we don't need to wrap the array
    const maybeOfListConstructor1D = R.compose(Maybe.Just, a => a);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Just (f (a))
    const myLittleMaybeListConcatter1D = lift1stOf2ForMDeepMonad(1, maybeOfListConstructor1D, R.concat);
    expect(myLittleMaybeListConcatter1D(['a'])(
      maybeOfListConstructor1D(['b', 'c', 'd'])
    )).toEqual(maybeOfListConstructor1D(['a', 'b', 'c', 'd']));

    // [a] -> Just [a]
    // In this case we want to operate on each item of the incoming array
    const maybeOfItemsConstructor = R.compose(Maybe.Just, a => a);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Result (Just (f (a)))
    const myLittleMaybeItemsAppender = lift1stOf2ForMDeepMonad(2, maybeOfItemsConstructor, R.concat);
    expect(myLittleMaybeItemsAppender('a')(maybeOfItemsConstructor(['b', 'c', 'd']))).toEqual(maybeOfItemsConstructor(['ab', 'ac', 'ad']));

    // [a] -> [Just a]
    // We have to wrap the incoming array so that we apply functions to the internal array instead of each individual
    // item of the array
    const listOfMaybeConstructor = R.compose(x => [x], Maybe.Just);

    // f -> [Just a] -> (Just (f (a)))
    const listOfMaybeAppender = lift1stOf2ForMDeepMonad(2, listOfMaybeConstructor, R.concat);
    const listOfMaybes = R.chain(listOfMaybeConstructor, ['b', 'c', 'd']);

    expect(listOfMaybeAppender('a')(listOfMaybes)).toEqual(
      R.chain(listOfMaybeConstructor, ['ab', 'ac', 'ad'])
    );
  });

  test('mapMDeep', done => {
    expect(mapMDeep(1, R.add(1), [1])).toEqual([2]);
    expect(mapMDeep(2, R.add(1), [[1]])).toEqual([[2]]);
    expect(mapMDeep(2, R.add(1), Result.Ok(Maybe.Just(1)))).toEqual(Result.Ok(Maybe.Just(2)));
    mapMDeep(2, R.add(1), of(Maybe.Just(1))).run().listen(
      defaultRunConfig({
        onResolved: resolve =>
          R.map(
            value => {
              expect(value).toEqual(2);
              done();
            },
            resolve
          )
      })
    );
  });

  test('mapMDeepWithArraysInObjects', () => {
    const waysOfNodeId = {
      1: [{features: ['FEATURE me']}, {features: ['no, FEATURE me']}],
      2: [{features: ['facial features']}, {features: ['new spring features'], suchas: ['heather and indigo features']}]
    };
    // Manipulate each array item of an object
    expect(mapMDeep(
      2,
      way => R.over(R.lensPath(['features', 0]), R.replace(/feature/, 'FEATURE'), way),
      waysOfNodeId)
    ).toEqual(
      {
        1: [{features: ['FEATURE me']}, {features: ['no, FEATURE me']}],
        2: [{features: ['facial FEATUREs']}, {
          features: ['new spring FEATUREs'],
          suchas: ['heather and indigo features']
        }]
      }
    );

    // Manipulate each object item of each array item of an object
    expect(mapMDeep(
      3,
      features => R.map(R.replace(/feature/, 'FEATURE'), features),
      waysOfNodeId)
    ).toEqual(
      {
        1: [{features: ['FEATURE me']}, {features: ['no, FEATURE me']}],
        2: [{features: ['facial FEATUREs']}, {
          features: ['new spring FEATUREs'],
          suchas: ['heather and indigo FEATUREs']
        }]
      }
    );

    // Manipulate each array item of each object item of each array item of an object
    expect(mapMDeep(
      4,
      str => R.replace(/feature/, 'FEATURE', str),
      waysOfNodeId)
    ).toEqual(
      {
        1: [{features: ['FEATURE me']}, {features: ['no, FEATURE me']}],
        2: [{features: ['facial FEATUREs']}, {
          features: ['new spring FEATUREs'],
          suchas: ['heather and indigo FEATUREs']
        }]
      }
    );
  });

  test('chainMDeep', done => {
    // Level 1 chain on array behaves like map, so we don't actually need to wrap it in Array.of here
    // I'm not sure why R.chain(R.identity, [2]) => [2] instead of 2,
    expect(chainMDeep(1, R.compose(Array.of, R.add(1)), [1])).toEqual([2]);

    expect(chainMDeep(1, R.compose(Maybe.Just, R.add(1)), Maybe.Just(1))).toEqual(Maybe.Just(2));
    // Strips a layer of array either way
    expect(chainMDeep(1, R.add(1), [[1]])).toEqual([2]);
    expect(chainMDeep(2, R.add(1), [[1]])).toEqual([2]);

    // Maintain the type by composing it within the chain function. Otherwise it gets unwrapped
    expect(chainMDeep(2, R.compose(Result.Ok, Maybe.Just, R.add(1)), Result.Ok(Maybe.Just(1)))).toEqual(Result.Ok(Maybe.Just(2)));
    expect(chainMDeep(2, R.add(1), Result.Ok(Maybe.Just(1)))).toEqual(2);

    // Same here, but we couldn't unwrap a task
    chainMDeep(2, R.compose(of, Maybe.Just, R.add(1)), of(Maybe.Just(1))).run().listen(
      defaultRunConfig({
        onResolved: resolve =>
          R.map(
            value => {
              expect(value).toEqual(2);
              done();
            },
            resolve
          )
      })
    );
  });

  test('objOfMLevelDeepMonadsToListWithPairs', () => {
    expect(objOfMLevelDeepMonadsToListWithPairs(
      1,
      Result.Ok,
      {a: Result.Ok(1), b: Result.Ok(2)})
    ).toEqual(
      [Result.Ok(['a', 1]), Result.Ok(['b', 2])]
    );

    expect(objOfMLevelDeepMonadsToListWithPairs(
      2,
      R.compose(Result.Ok, Maybe.Just),
      {a: Result.Ok(Maybe.Just(1)), b: Result.Ok(Maybe.Just(2))})
    ).toEqual(
      [Result.Ok(Maybe.Just(['a', 1])), Result.Ok(Maybe.Just(['b', 2]))]
    );

    expect(objOfMLevelDeepMonadsToListWithPairs(
      2,
      R.compose(Result.Ok, Maybe.Just),
      {a: Result.Ok(Maybe.Just(1)), b: Result.Error(Maybe.Just(2))})
    ).toEqual(
      // Mapping doesn't happen on the Result.Error
      [Result.Ok(Maybe.Just(['a', 1])), Result.Error(Maybe.Just(2))]
    );
  });

  test('objOfMLevelDeepListOfMonadsToListWithPairs', () => {
    const level1Constructor = R.compose(Maybe.Just);
    // Map each array item to the constructor
    const objOfLevel1Monads = R.map(R.map(level1Constructor), {b: [1, 2], c: [3, 4], d: [4, 5]});

    expect(objOfMLevelDeepListOfMonadsToListWithPairs(1, level1Constructor, objOfLevel1Monads)).toEqual(
      R.map(level1Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );

    const level2Constructor = R.compose(Result.Ok, Maybe.Just);
    const objOfLevel2Monads = R.map(R.map(level2Constructor), {b: [1, 2], c: [3, 4], d: [4, 5]});

    expect(objOfMLevelDeepListOfMonadsToListWithPairs(2, level2Constructor, objOfLevel2Monads)).toEqual(
      R.map(level2Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );
  });

  test('pairsOfMLevelDeepListOfMonadsToListWithPairs', () => {
    const level1Constructor = R.compose(Maybe.Just);
    const pairsOfLevel1Monads = [
      ['b', R.map(level1Constructor, [1, 2])],
      ['c', R.map(level1Constructor, [3, 4])],
      ['d', R.map(level1Constructor, [4, 5])]
    ];

    // Note that I pass 2 here to indicate that the monad is two levels A Maybe containing an array
    // It's always confusing treating a list as monad because Array.of expects a list, which makes
    // it hard to think about
    expect(pairsOfMLevelDeepListOfMonadsToListWithPairs(1, level1Constructor, pairsOfLevel1Monads)).toEqual(
      R.map(level1Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );

    const level2Constructor = R.compose(Result.Ok, Maybe.Just);
    const pairsOfLevel2Monads = [
      ['b', R.map(level2Constructor, [1, 2])],
      ['c', R.map(level2Constructor, [3, 4])],
      ['d', R.map(level2Constructor, [4, 5])]
    ];

    expect(pairsOfMLevelDeepListOfMonadsToListWithPairs(2, level2Constructor, pairsOfLevel2Monads)).toEqual(
      R.map(level2Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );
  });

  test('Technology test: chaining', () => {
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
  });

  test('Lifting monads that include lists', () => {
    // Now play with lists. If we could apply lists it would look like this
    // List.of(R.add).ap([1, 2]).ap(10, 11), meaning map [1, 2] with R.add and then map [10, 11] to the results of that
    // Because we are operating within the container of a list the four resulting values are in one single list
    // It works using R.lift
    // This First applies add to [1, 2], literally meaning we call R.map(R.add, [1, 2]), yielding
    // two partials as a func: x => [R.add(1), R.add(2)]. Next we apply the partials to [10, 11], literally meaning we call
    // R.map(x => [R.add(1), R.add(2)], [10, 11]), yielding [11, 12, 12, 13]
    // The important thing to note is that R.add operates on each item of the list because each of the first list is mapped to
    // the R.add to get partials and then each of the second list is mapped to that to each partial
    // The reason the list is flat is because R.liftN detects arrays and does an array reduce,
    // just as it does other reductions to combine other monad types, like Tasks
    expect(R.liftN(2, R.add)([1, 2], [10, 11])).toEqual([11, 12, 12, 13]);

    // Now combine lists with Result. Since we receive an array there's nothing to do to contain it,
    // I'm leaving R.identity here to display my confusion. There is no Array.of and the incoming value is an array
    const resultListConstructor = R.compose(Result.Ok, R.identity);
    // This should add the each item from each array
    const myLittleResultWithListConcatter = lift1stOf2ForMDeepMonad(2, resultListConstructor, R.add);
    expect(myLittleResultWithListConcatter([1, 2])(resultListConstructor([10, 11]))).toEqual(resultListConstructor([11, 12, 12, 13]));

    // This shows us how we can map multiple values, solving the embedded map problem
    expect(R.liftN(2,
      (startEnd, routeResponse) => R.view(R.lensPath(['legs', 0, startEnd]), routeResponse)
    )(['start_address', 'end_address'], [{
      legs: [{
        start_address: 'foo',
        end_address: 'bar'
      }]
    }])).toEqual(['foo', 'bar']);

    // We can do the same thing with our method and not have to awkwardly wrap the object in an array
    expect(lift1stOf2ForMDeepMonad(1, Array.of,
      R.curry((routeResponse, startEnd) => R.view(R.lensPath(['legs', 0, startEnd]), routeResponse)),
      {legs: [{start_address: 'foo', end_address: 'bar'}]},
      ['start_address', 'end_address']
    )).toEqual(['foo', 'bar']);

    // Using the above could we iterate through deep lists or objects and call a function on every combination?
  });

  test('Lifting objects with monads', () => {
    // Processing objects with monads
    const resultMaybeConstructor = R.compose(Result.Ok, Maybe.Just);
    const myObject = {a: resultMaybeConstructor(1), b: resultMaybeConstructor(2)};
    const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(2, resultMaybeConstructor, (k, v) => [[k, v]]);
    // We can map each to put the keys into the monad, converting the k, v to an array with one pair
    // Object <k, (Result (Maybe v))> -> [Result (Maybe [[k, v]]) ]
    const listOfResultOfMaybeOfListOfOnePair = R.map(
      ([k, v]) => liftKeyIntoMonad(k, v),
      R.toPairs(myObject)
    );
    expect(listOfResultOfMaybeOfListOfOnePair).toEqual(
      [resultMaybeConstructor([['a', 1]]), resultMaybeConstructor([['b', 2]])]
    );
    // Now let's make a single Result. We use traverseReduce so we can call a reduction function
    // that combines the underlying values. I still don't know if ramda has a version of this
    // [Result (Maybe [[k, v]]) ] -> Result (Maybe [[k, v], [k, v]...])
    const resultOfMaybeOfListOfPairs = traverseReduce(
      (a, b) => R.concat(a, b),
      resultMaybeConstructor([]), // Initial value is an empty array. We'll concat arrays of single pairs to it
      listOfResultOfMaybeOfListOfOnePair
    );
    expect(resultOfMaybeOfListOfPairs).toEqual(resultMaybeConstructor([['a', 1], ['b', 2]]));
  });


  /*
  test('liftObjDeep', () => {
    const pairs = liftObjDeep({city: "Stavanger", data: {sidewalk: [0, 2], plazaSq: [0, 3]}})
    R.liftN(R.length(pairs), (...pairs) => [...pairs], ...R.map(R.last, pairs))
  })
  */

  test('mapToResponseAndInputs', done => {
    R.compose(
      mapToResponseAndInputs(({a, b, c}) => of({d: a + 1, f: b + 1, g: 'was 1 2'}))
    )({a: 1, b: 1, c: 'was a racehorse'}).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual({a: 1, b: 1, c: 'was a racehorse', value: {d: 2, f: 2, g: 'was 1 2'}});
          done();
        }
      })
    );
  });

  test('mapToNamedResponseAndInputs', done => {
    const errors = [];
    const tsk = mapToNamedResponseAndInputs('foo', ({a, b, c}) => of({d: a + 1, f: b + 1, g: 'was 1 2'}));
    tsk({a: 1, b: 1, c: 'was a racehorse'}).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual({a: 1, b: 1, c: 'was a racehorse', foo: {d: 2, f: 2, g: 'was 1 2'}});
        }
      }, errors, done)
    );
  });

  test('toNamedResponseAndInputs', () => {
    const value = toNamedResponseAndInputs(
      'foo',
      ({a, b, c}) => ({d: a + 1, f: b + 1, g: 'was 1 2'}),
      ({a: 1, b: 1, c: 'was a racehorse'})
    );
    expect(value).toEqual({a: 1, b: 1, c: 'was a racehorse', foo: {d: 2, f: 2, g: 'was 1 2'}});
  });

  test('mapToPath', done => {
    const errors = [];
    mapToPath(
      'is.1.goat',
      of({is: [{cow: 'grass'}, {goat: 'can'}]})
    ).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('can');
        }
      }, errors, done)
    );
  });

  test('mapWithArgToPath', done => {
    const errors = [];
    mapWithArgToPath(
      'is.1.goat',
      ({a, b, c}) => of({is: [{cow: 'grass'}, {goat: 'can'}]})
    )({a: 1, b: 1, c: 'was a racehorse'}).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('can');
        }
      }, errors, done)
    );
  });

  test('mapToNamedPathAndInputs', done => {
    const errors = [];
    R.compose(
      mapToNamedPathAndInputs(
        'billy',
        'is.1.goat',
        ({a, b, c}) => of({is: [{cow: 'grass'}, {goat: 'can'}]})
      )
    )({a: 1, b: 1, c: 'was a racehorse'}).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual({a: 1, b: 1, c: 'was a racehorse', billy: 'can'});
        }
      }, errors, done)
    );
  });

  test('mapResultMonadWithOtherInputs', done => {
    expect.assertions(6);
    const errors = [];

    // Case: f returns a Result.Ok
    mapResultMonadWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        inputKey: 'kid',
        resultOutputKey: 'billyGoatResult',
        monad: of
      },
      ({kid}) => of(Result.Ok(R.concat(kid, ' became a billy goat')))
    )({a: 1, b: 1, kidResult: Result.Ok('Billy the kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.map(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy the kid became a billy goat'});
        })
      }, errors, done)
    );

    // Case: f returns a value that needs to be wrapped in a Result.Ok
    mapResultMonadWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        inputKey: 'kid',
        resultOutputKey: 'billyGoatResult',
        wrapFunctionOutputInResult: true,
        monad: of
      },
      ({kid}) => of(R.concat(kid, ' became a billy goat'))
    )({a: 1, b: 1, kidResult: Result.Ok('Billy the kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.map(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy the kid became a billy goat'});
        })
      }, errors, done)
    );

    // Case: incoming Result is a Result.Error
    mapResultMonadWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        inputKey: 'kid',
        resultOutputKey: 'billyGoatResult',
        monad: of
      },
      ({kid}) => of(R.concat(kid, Result.Ok(' became a billy goat')))
    )({a: 1, b: 1, kidResult: Result.Error('Billy was never a kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.mapError(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy was never a kid'});
        })
      }, errors, done)
    );

    // Case: outgoing Result is a Result.Error
    mapResultMonadWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        inputKey: 'kid',
        resultOutputKey: 'billyGoatResult',
        monad: of
      },
      ({kid}) => of(Result.Error(R.concat(kid, ' never became a billy goat')))
    )({a: 1, b: 1, kidResult: Result.Ok('Billy the kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.mapError(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy the kid never became a billy goat'});
        })
      }, errors, done)
    );

    // Case: resultInputKey and resultOutputKey is not specified, so use all of the inputObj as a Result
    mapResultMonadWithOtherInputs(
      {
        monad: of
      },
      ({kid, ...rest}) => of(
        Result.Ok(
          R.merge(R.map(R.add(5), rest), {kid: R.concat(kid, ' and his friends became a billy goats')})
        )
      )
    )(Result.Ok({a: 1, b: 1, kid: 'Billy the kid'})).run().listen(
      defaultRunConfig({
        onResolved: result => result.map(stuff => {
          expect(stuff).toEqual({a: 6, b: 6, kid: 'Billy the kid and his friends became a billy goats'});
        })
      }, errors, done)
    );

    // Case: resultInputKey and resultOutputKey is not specified, outgoing Result is a Result.Error
    mapResultMonadWithOtherInputs(
      {
        monad: of
      },
      ({kid, ...rest}) => of(
        Result.Error(
          R.merge(rest, {kid: R.concat(kid, ' and his friends were shot')})
        )
      )
    )(Result.Ok({a: 1, b: 1, kid: 'Billy the kid'})).run().listen(
      defaultRunConfig({
        onResolved: result => result.mapError(stuff => {
          expect(stuff).toEqual({a: 1, b: 1, kid: 'Billy the kid and his friends were shot'});
        })
      }, errors, done)
    );
  });

  test('mapResultTaskWithOtherInputs', done => {
    expect.assertions(5);
    const errors = [];
    mapResultTaskWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        resultOutputKey: 'billyGoatResult'
      },
      ({kid}) => of(Result.Ok(R.concat(kid, ' became a billy goat')))
    )({a: 1, b: 1, kidResult: Result.Ok('Billy the kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.map(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy the kid became a billy goat'});
        })
      }, errors, done)
    );

    // Make sure that the monad defaults to Task for error Results
    mapResultTaskWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        resultOutputKey: 'billyGoatResult'
      },
      ({kid}) => of(Result.Ok(R.concat(kid, ' became a billy goat')))
    )({a: 1, b: 1, kidResult: Result.Error('Billy was never a kid')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.mapError(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'Billy was never a kid'});
        })
      }, errors, done)
    );

    // Make sure that the monad defaults to Task with a Result.Error for rejected Task
    mapResultTaskWithOtherInputs(
      {
        resultInputKey: 'kidResult',
        resultOutputKey: 'billyGoatResult'
      },
      ({kid}) => rejected('It doesn\'t matter what Billy was')
    )({a: 1, b: 1, kidResult: Result.Ok('Billy will never be')}).run().listen(
      defaultRunConfig({
        onResolved: ({billyGoatResult, ...rest}) => billyGoatResult.mapError(billyGoat => {
          expect({billyGoat, ...rest}).toEqual({a: 1, b: 1, billyGoat: 'It doesn\'t matter what Billy was'});
        })
      }, errors, done)
    );

    // When we don't map keys things still work
    mapResultTaskWithOtherInputs(
      {},
      ({kid, ...rest}) => of(Result.Ok({kid: R.concat(kid, ' and his friends became a billy goat'), ...rest}))
    )(Result.Ok({a: 1, b: 1, kid: 'Billy the kid'})).run().listen(
      defaultRunToResultConfig({
        onResolved: stuff => {
          expect(stuff).toEqual({a: 1, b: 1, kid: 'Billy the kid and his friends became a billy goat'});
        }
      }, errors, done)
    );

    // When we don't map keys things still work
    mapResultTaskWithOtherInputs(
      {},
      ({kid, ...rest}) => rejected('Catastrophe, and I\'m not even a result!')
    )(Result.Ok({a: 1, b: 1, kid: 'Billy the kid'})).run().listen(
      defaultRunToResultConfig({
        onRejected: (errorz, error) => {
          expect(error).toEqual('Catastrophe, and I\'m not even a result!');
        }
      }, errors, done)
    );
  });

  test('waitAllBucketed', done => {
    expect.assertions(1);
    const errors = [];
    const tasks = num => R.times(() => of('I\'m a big kid now'), num);

    waitAllBucketed(tasks(100000)).run().listen(defaultRunConfig({
      onResolved: stuff => {
        expect(R.length(stuff)).toEqual(100000);
      }
    }, errors, done));

    // For huge numbers of tasks increase the buckets size. This causes waitAllBucketed to recurse
    // and get the bucket size down to 100 (i.e. Order 100 stack calls)
    // Disabled because it takes a while to run, but it passes
    /*
    waitAllBucketed(tasks(1000000), 1000).run().listen(defaultRunConfig({
      onResolved: stuff => {
        expect(R.length(stuff)).toEqual(1000000);
      }
    }, errors, done));
    */
  });

  test('sequenceBucketed', done => {
    expect.assertions(1);
    const errors = [];
    const tasks = num => R.times(() => of(1), num);

    sequenceBucketed(tasks(100000)).run().listen(defaultRunConfig({
      onResolved: stuff => {
        expect(R.length(stuff)).toEqual(100000);
      }
    }, errors, done));

    /*
    Works but takes too long
    // For huge numbers of tasks increase the buckets size. This causes waitAllBucketed to recurse
    // and get the bucket size down to 100 (i.e. Order 100 stack calls)
    // Disabled because it takes a while to run, but it passes
    sequenceBucketed(tasks(1000000, 1000)).run().listen(defaultRunConfig({
      onResolved: stuff => {
        expect(R.length(stuff)).toEqual(1000000);
      }
    }, errors, done));
     */
  });

  test('traverseReduceError', () => {
    expect(
      traverseReduceError(
        error => error.matchWith({Error: ({value}) => value}),
        // Concat the strings
        R.concat,
        Result.Error(''),
        [Result.Error('Cowardly'), Result.Error('Scarecrow')]
      )
    ).toEqual(Result.Error('CowardlyScarecrow'));
  });
  
  test('traverseReduceResultError', () => {
    expect(
      traverseReduceResultError(
        // Concat the strings
        R.concat,
        Result.Error(''),
        [Result.Error('Cowardly'), Result.Error('Scarecrow')]
      )
    ).toEqual(Result.Error('CowardlyScarecrow'));
  });
});

