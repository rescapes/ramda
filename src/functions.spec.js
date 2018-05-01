/**
 * Created by Andy Likuski on 2017.02.26
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import * as f from './functions';
import Task from 'data.task';
import {Just} from 'data.maybe';
import {Either} from 'ramda-fantasy';

describe('helperFunctions', () => {
  test('Should be empty', () => {
    expect(f.orEmpty(null)).toEqual('');
  });

  test('Should filter out null and undef values', () => {
    expect(f.compact([1, null, 2])).toEqual([1, 2]);
  });

  test('Should filter out null and empty values', () => {
    expect(f.compactEmpty(['', null, []])).toEqual([]);
  });

  test('emptyToNull', () => {
    expect(f.emptyToNull('')).toEqual(null);
  });

  test('compactJoin should compact and join', () => {
    expect(f.compactJoin('-', ['', 'a', null, 'b'])).toEqual('a-b');
    expect(f.compactJoin('-', ['', null])).toEqual(null);
  });

  test('Should map bars', () => {
    expect(f.mapProp('bar')([{bar: 1}, {bar: 2}])).toEqual([1, 2]);
  });

  test('Should map prop as key', () => {
    expect(f.mapPropValueAsIndex('bar')([{bar: 1}, {bar: 2}])).toEqual(R.indexBy(R.prop('bar'), [{bar: 1}, {bar: 2}]));
  });

  test('Should remove duplicate objects with same prop key', () => {
    expect(f.removeDuplicateObjectsByProp('bar')([{bar: 1, foo: 2}, {bar: 1, foo: 2}, {bar: 2}])).toEqual([{
      bar: 1,
      foo: 2
    }, {bar: 2}]);
  });

  test('Should return an id from an object or the identify from a value', () => {
    expect(f.idOrIdFromObj('foo')).toEqual('foo');
    expect(f.idOrIdFromObj({id: 'foo'})).toEqual('foo');
  });

  test('Should sum up distance between', () => {
    expect(f.reduceWithNext(
      (previous, current, next) => previous + (next - current),
      [1, 4, 9, 16],
      0)).toEqual((4 - 1) + (9 - 4) + (16 - 9));
  });

  test('Should concat with sums of distance between', () => {
    expect(f.reduceWithNext(
      (previous, current, next) => previous.concat([next - current]),
      [1, 4, 9, 16],
      [])).toEqual([4 - 1, 9 - 4, 16 - 9]);
  });

  test('Should deep merge objects', () => {
    expect(f.mergeDeep(
      {foo: 1, bar: {bizz: [2, 3], buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6]}}
    )).toEqual({foo: 4, bar: {bizz: [5, 6], buzz: 7}});
  });

  test('Should deep merge objects with a function', () => {
    expect(f.mergeDeepWith(
      (l, r) => R.when(
        R.is(Number),
        R.add(l)
      )(r),
      {foo: 1, bar: {bizz: [2, 3], buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6]}}
    )).toEqual({foo: 5, bar: {bizz: [5, 6], buzz: 7}});
  });

  test('Should merge deep all objects', () => {
    expect(f.mergeDeepAll([
      {foo: 1, bar: {bizz: [2, 3], buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6]}},
      {foo: 4, bar: {cat: [5, 6], pterodactyl: 'time is running out!'}}
    ])).toEqual(
      {foo: 4, bar: {bizz: [5, 6], buzz: 7, cat: [5, 6], pterodactyl: 'time is running out!'}}
    );
  });

  test('Should capitalize first letter', () => {
    expect(f.capitalize('good grief')).toEqual('Good grief');
  });

  test('Required path', () => {
    expect(f.reqPath(['a'], {a: 1}).value).toBe(1);
    expect(f.reqPath(['a', 'b'], {a: {c: 1}}).value).toEqual({
      resolved: ['a'],
      path: ['a', 'b']
    });
  });

  test('reqStrPath', () => {
    expect(f.reqStrPath('foo.bar.goo', {
      foo: {
        bar: {
          goo: 1
        }
      }
    })).toEqual(Either.Right(1));

    expect(f.reqStrPath('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toEqual(Either.Left(
      {
        resolved: ['foo'],
        path: ['foo', 'bar', 'goo']
      })
    );
  });

  test('strPath', () => {
    expect(f.strPath('foo.bar.goo', {
      foo: {
        bar: {
          goo: 1
        }
      }
    })).toEqual(1);

    expect(typeof f.strPath('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toEqual('undefined');
  });

  test('strPathOr', () => {
    expect(f.strPathOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(false);
    expect(f.strPathOr(1, 'tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(1);
  });

  test('hasStrPath', () => {
    expect(f.hasStrPath('tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(true);
    expect(f.hasStrPath('tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(false);
  });

  test('Required path prop equals', () => {
    expect(f.reqPathPropEq(['a'], 1, {a: 1}).value).toBe(true);
    expect(f.reqPathPropEq(['a', 'b'], 1, {a: {c: 1}}).value).toEqual({
      resolved: ['a'],
      path: ['a', 'b']
    });
  });

  test('Should merge all with key', () => {
    expect(
      f.mergeAllWithKey(
        (k, l, r) => k === 'a' ? R.concat(l, r) : r,
        [{a: [1], b: 2}, {a: [2], c: 3}, {a: [3]}]
      )).toEqual({a: [1, 2, 3], b: 2, c: 3});
  });

  test('Should reqPath of object', () => {
    expect(
      f.reqPath(['a', 'b', 1, 'c'], {a: {b: [null, {c: 2}]}})
    ).toEqual(Just(2));
  });

  test('Should convert Task to Promise', async () => {
    await expect(f.taskToPromise(new Task(function (reject, resolve) {
      resolve('donut');
    }))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(f.taskToPromise(new Task(function (reject) {
      reject(err);
    }), true)).rejects.toBe(err);
  });

  test('Should convert Promise to Task', async () => {
    await expect(f.taskToPromise(f.promiseToTask(new Promise(function (resolve, reject) {
      resolve('donut');
    })))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(f.taskToPromise(f.promiseToTask(new Promise(function (resolve, reject) {
      reject(err);
    }), true))).rejects.toBe(err);
  });

  test('mapKeys', () => {
    expect(f.mapKeys(
      key => `${f.capitalize(key)} Taco`,
      {fish: 'good', puppy: 'bad'})
    ).toEqual(
      {['Fish Taco']: 'good', ['Puppy Taco']: 'bad'}
    );
  });

  test('mapKeysForLens', () => {
    expect(f.mapKeysForLens(
      R.lensPath(['x', 1, 'y']),
      key => `${f.capitalize(key)} Taco`,
      {x: [null, {y: {fish: 'good', puppy: 'bad'}}]}
      )
    ).toEqual(
      {x: [null, {y: {['Fish Taco']: 'good', ['Puppy Taco']: 'bad'}}]}
    );
  });

  test('mapDefault should rename the default import', () => {
    expect(f.mapDefault('friend', {default: 'foo', other: 'boo'})).toEqual(
      {friend: 'foo', other: 'boo'}
    );
  });

  test('mapDefaultAndPrefixOthers should rename the default and prefix others', () => {
    expect(f.mapDefaultAndPrefixOthers('friend', 'prefix', {default: 'foo', other: 'boo'})).toEqual(
      {friend: 'foo', prefixOther: 'boo'}
    );
  });

  test('transformKeys', () => {
    expect(f.transformKeys(
      f.camelCase,
      {
        who_made_me_with_slugs: 'the snail',
        'what-kind-of-camel-Races': 'a dromedary'
      }
    )).toEqual(
      {
        whoMadeMeWithSlugs: 'the snail',
        whatKindOfCamelRaces: 'a dromedary'
      }
    );
  });

  test('renameKey', () => {
    expect(
      f.renameKey(R.lensPath(['x', 'y']), 'z', 'and per se', {x: {y: {z: {cactus: 'blossoms'}}}})
    ).toEqual(
      {x: {y: {'and per se': {cactus: 'blossoms'}}}}
    );
  });

  test('duplicateKey', () => {
    expect(
      f.duplicateKey(R.lensPath(['x', 'y']), 'z', ['and per se', 'a per se', 'o per se'], {x: {y: {z: {cactus: 'blossoms'}}}})
    ).toEqual(
      {
        x: {
          y: {
            z: {cactus: 'blossoms'},
            'and per se': {cactus: 'blossoms'},
            'a per se': {cactus: 'blossoms'},
            'o per se': {cactus: 'blossoms'}
          }
        }
      }
    );
  });

  test('moveToKeys', () => {
    expect(
      f.moveToKeys(R.lensPath(['x', 'y']), 'z', ['and per se', 'a per se', 'o per se'], {x: {y: {z: {cactus: 'blossoms'}}}})
    ).toEqual(
      {
        x: {
          y: {
            'and per se': {cactus: 'blossoms'},
            'a per se': {cactus: 'blossoms'},
            'o per se': {cactus: 'blossoms'}
          }
        }
      }
    );
  });

  test('findOne', () => {
    // Works with objects
    expect(
      f.findOne(R.equals('Eli Whitney'), {a: 1, b: 'Eli Whitney'})
    ).toEqual(
      Either.Right({b: 'Eli Whitney'})
    );

    // Works with arrays
    expect(
      f.findOne(R.equals('Eli Whitney'), [1, 'Eli Whitney'])
    ).toEqual(
      Either.Right(['Eli Whitney'])
    );

    // None
    expect(
      f.findOne(R.equals('Eli Whitney'), {a: 1, b: 2})
    ).toEqual(
      Either.Left({all: {a: 1, b: 2}, matching: {}})
    );

    // Too many
    expect(
      f.findOne(R.equals('Eli Whitney'), {a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Either.Left({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('onlyOne', () => {
    expect(f.onlyOne({a: 'Eli Whitney'})).toEqual(Either.Right({a: 'Eli Whitney'}));

    // None
    expect(
      f.onlyOne({})
    ).toEqual(
      Either.Left({all: {}, matching: {}})
    );

    // Too many
    expect(
      f.onlyOne({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Either.Left({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('onlyOneValue', () => {
    expect(f.onlyOneValue({a: 'Eli Whitney'})).toEqual(Either.Right('Eli Whitney'));

    // None
    expect(
      f.onlyOneValue({})
    ).toEqual(
      Either.Left({all: {}, matching: {}})
    );

    // Too many
    expect(
      f.onlyOneValue({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Either.Left({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('mapToObjValue', () => {
    expect(f.mapToObjValue(R.compose(f.camelCase, R.toLower), ['MY', 'SHOES_FIT'])).toEqual({
      MY: 'my',
      SHOES_FIT: 'shoesFit'
    });
  });

  test('findOneValueByParams', () => {
    const items = [
      {brand: 'crush', flavor: 'grape'},
      {brand: 'fanta', flavor: 'strawberry'},
      {brand: 'crush', flavor: 'orange'}
    ];
    const params = {brand: 'crush', flavor: 'orange'};
    expect(f.findOneValueByParams(params, items)).toEqual(
      Either.Right({brand: 'crush', flavor: 'orange'})
    );
    const badParams = {brand: 'crush', flavor: 'pretzel'};
    expect(f.findOneValueByParams(badParams, items)).toEqual(
      Either.Left(
        {
          all: [{brand: 'crush', flavor: 'grape'}, {
            brand: 'fanta',
            flavor: 'strawberry'
          }, {brand: 'crush', flavor: 'orange'}], matching: []
        }
      )
    );
    const tooGoodParams = {brand: 'crush'};
    expect(f.findOneValueByParams(tooGoodParams, items)).toEqual(
      Either.Left(
        {
          all: [{brand: 'crush', flavor: 'grape'}, {
            brand: 'fanta',
            flavor: 'strawberry'
          }, {brand: 'crush', flavor: 'orange'}],
          matching: [{brand: 'crush', flavor: 'grape'}, {brand: 'crush', flavor: 'orange'}]
        }
      )
    );
  });
  test('reduceWithNext', () => {
    expect(f.reduceWithNext(R.identity, [1, 2, 3])).toEqual([[1, 2], [2, 3]]);
  });

  test('alwaysFunc', () => {
    const alwaysIWannaFuncWithYou = R.identity;
    const str = 'and make believe with you';
    expect(f.alwaysFunc(alwaysIWannaFuncWithYou)('and live in harmony')).toEqual('and live in harmony');
    expect(f.alwaysFunc(str)(1, 1, 'was', 'a racehorse')).toEqual(str);
  });

  test('traverseReduce', (done) => {
    const merge = (res, [k, v]) => R.merge(res, {[k]: v});
    const initialValue = apConstructor => apConstructor({});

    const initialEither = initialValue(Either.of);
    // Convert dict into list of Either([k,v])
    const objOfApplicativesToApplicative = R.curry((apConstructor, objOfApplicatives) => f.mapObjToValues(
      (v, k) => {
        return v.chain(val => apConstructor([k, val]));
      },
      objOfApplicatives
    ));

    expect(
      f.traverseReduce(
        merge,
        initialEither,
        objOfApplicativesToApplicative(Either.of, {a: Either.of('a'), b: Either.of('b')})
      )
    ).toEqual(
      Either.of({a: 'a', b: 'b'})
    );

    const mapper = objOfApplicativesToApplicative(Task.of);
    const initialTask = initialValue(Task.of);
    // More complicated
    const task = R.composeK(
      // returns a single Task
      letterToApplicative => f.traverseReduce(merge, initialTask, mapper(letterToApplicative)),
      values =>
        // wrap in Task.of to support composeK
        Task.of(
          R.map(
            // First reduce each letter value to get
            //  {
            //  a: Task({apple: Either.of('apple'), aardvark: Either.of('aardvark')}),
            //  b: Task({banana: Either.of('banana'), bonobo: Either.of('bonobo')})
            //  }
            v => f.traverseReduce(
              merge,
              initialTask,
              mapper(v)
            ),
            values
          )
        )
    )(
      {
        a: {apple: Task.of('apple'), aardvark: Task.of('aardvark')},
        b: {banana: Task.of('banana'), bonobo: Task.of('bonobo')}
      }
    );
    task.fork(
      reject => {
        throw(reject);
      },
      result => {
        expect(result).toEqual({
          a: {apple: 'apple', aadrvark: 'aardvark'},
          b: {banana: 'banana', bonobo: 'bonobo'}
        });
        done();
      }
    );
  });
});
