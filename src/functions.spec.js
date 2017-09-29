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
const R = require('ramda');
const f = require('./functions');
const Task = require('data.task');
const {Just} = require('data.maybe');

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
      {who_made_me_with_slugs: 'the snail',
      'what-kind-of-camel-Races': 'a dromedary'
      }
    )).toEqual(
      {whoMadeMeWithSlugs: 'the snail',
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
      {x: {y: {
        z: {cactus: 'blossoms'},
        'and per se': {cactus: 'blossoms'},
        'a per se': {cactus: 'blossoms'},
        'o per se': {cactus: 'blossoms'}
      }}}
    );
  });
});
