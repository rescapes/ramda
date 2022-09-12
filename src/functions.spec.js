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
import {
  _mergeDeepWithRecurseArrayItemsByRight,
  alwaysFunc,
  camelCase,
  capitalize,
  chainObjToValues,
  compact,
  compactEmpty,
  compactJoin,
  duplicateKey,
  emptyToNull,
  filterObjToValues,
  findByParams,
  findMapped,
  findMappedAndResolve,
  findOne,
  findOneValueByParams,
  flattenObj,
  flattenObjUntil,
  fromPairsDeep,
  idOrIdFromObj,
  isObject,
  keyStringToLensPath,
  mapDefault,
  mapDefaultAndPrefixOthers,
  mapKeys,
  mapKeysAndValues,
  mapKeysForLens,
  mapObjToValues,
  mapProp,
  mapPropValueAsIndex,
  mapToObjValue,
  mergeAllWithKey,
  mergeDeep,
  mergeDeepAll,
  mergeDeepWith,
  mergeDeepWithConcatArrays,
  mergeDeepWithKeyWithRecurseArrayItemsAndMapObjs,
  mergeDeepWithRecurseArrayItems,
  mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight,
  mergeDeepWithRecurseArrayItemsByRight,
  moveToKeys,
  omitDeep,
  omitDeepBy,
  omitDeepPaths,
  onlyOne,
  onlyOneValue,
  orEmpty,
  overDeep,
  pickDeepPaths,
  removeDuplicateObjectsByProp,
  renameKey,
  replaceValuesAtDepth,
  replaceValuesAtDepthAndStringify,
  replaceValuesWithCountAtDepth,
  setMatchingMappedBoolAndResolve,
  splitAtInclusive,
  toArrayIfNot,
  transformKeys,
  unflattenObj,
  unflattenObjNoArrays
} from './functions.js';
import Result from 'folktale/result/index.js';
import {reqStrPathThrowing} from './propPathFunctionsThrowing.js';

const recurseMe = {
  the: {
    frog: {
      to: {
        catch: null
      }
    }
  }
};
recurseMe.the.frog.to.catch = recurseMe;
const recursive = {
  she: {
    swallowed: recurseMe
  }
};

describe('helperFunctions', () => {
  test('Should be empty', () => {
    expect(orEmpty(null)).toEqual('');
  });

  test('Should filter out null and undef values', () => {
    expect(compact([1, null, 2])).toEqual([1, 2]);
  });

  test('Should filter out null and empty values', () => {
    expect(compactEmpty(['', null, []])).toEqual([]);
  });

  test('emptyToNull', () => {
    expect(emptyToNull('')).toEqual(null);
  });

  test('compactJoin should compact and join', () => {
    expect(compactJoin('-', ['', 'a', null, 'b'])).toEqual('a-b');
    expect(compactJoin('-', ['', null])).toEqual(null);
  });

  test('Should map bars', () => {
    expect(mapProp('bar')([{bar: 1}, {bar: 2}])).toEqual([1, 2]);
  });

  test('Should map prop as key', () => {
    expect(mapPropValueAsIndex('bar')([{bar: 1}, {bar: 2}])).toEqual(R.indexBy(R.prop('bar'), [{bar: 1}, {bar: 2}]));
  });

  test('Should remove duplicate objects with same prop key', () => {
    expect(removeDuplicateObjectsByProp('bar')([{bar: 1, foo: 2}, {bar: 1, foo: 2}, {bar: 2}])).toEqual([{
      bar: 1,
      foo: 2
    }, {bar: 2}]);
  });

  test('Should return an id from an object or the identify from a value', () => {
    expect(idOrIdFromObj('foo')).toEqual('foo');
    expect(idOrIdFromObj({id: 'foo'})).toEqual('foo');
  });

  test('Should deep merge objects', () => {
    expect(R.omit(['recursive'], mergeDeep(
      {foo: 1, recursive, bar: {bizz: [2, 3], buzz: 7}},
      {foo: 4, recursive, bar: {bizz: [5, 6]}}
    ))).toEqual({foo: 4, bar: {bizz: [5, 6], buzz: 7}});
  });

  test('Should deep merge objects but ignore dates', () => {
    const date = new Date();
    expect(mergeDeep({date}, {date})).toEqual({date});
    expect(R.omit(['recursive'], mergeDeep(
      {foo: 1, recursive, bar: {bizz: [date, 3], buzz: 7, date}},
      {foo: 4, recursive, bar: {bizz: [date, 6]}}
    ))).toEqual({foo: 4, bar: {bizz: [date, 6], buzz: 7, date}});
  });

  test('Should deep merge objects with a function', () => {
    expect(omitDeepPaths(['bar.recursive'], mergeDeepWith(
      (l, r) => R.when(
        R.is(Number),
        R.add(l)
      )(r),
      {foo: 1, bar: {bizz: [2, 3], recursive, buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6], recursive}}
    ))).toEqual({foo: 5, bar: {bizz: [5, 6], buzz: 7}});
  });

  test('Should deep merge objects and concat arrays of matching keys', () => {
    expect(omitDeepPaths(['bar.recursive'], mergeDeepWithConcatArrays(
      {foo: 1, bar: {bizz: [2, 3], recursive, buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6], recursive}}
    ))).toEqual({foo: 4, bar: {bizz: [2, 3, 5, 6], buzz: 7}});
  });

  test('mergeDeepWithRecurseArrayItems', () => {
    const date = new Date();
    expect(omitDeep(['recursive'], mergeDeepWithRecurseArrayItems(
      (k, l, r) => {
        return R.when(
          R.is(Number),
          R.add(l)
        )(r);
      },
      {foo: 1, bar: {bizz: [['carter', 'babs'], 2, {brewer: 9, recursive}, {me: new Date()}], buzz: 7}},
      {foo: 4, bar: {bizz: [['pete', 'lois', 'brian', 'meg'], 5, {brewer: 10, recursive}, {me: date}]}}
    ))).toEqual({foo: 5, bar: {bizz: [['pete', 'lois', 'brian', 'meg'], 7, {brewer: 19}, {me: date}], buzz: 7}});
  });


  test('mergeDeepWithRecurseArrayItemsByRight', () => {
    expect(omitDeep(['recursive'], mergeDeepWithRecurseArrayItemsByRight(
      (v, k) => R.when(isObject, R.propOr(v, 'id'))(v),
      {foo: 1, bar: {bizz: [{buddy: 2, id: 2, cow: 4}, {brewer: 9}], buzz: 7}},
      {foo: 4, bar: {bizz: [5, {buddy: 10, id: 2, snippy: 1, recursive}]}}
    ))).toEqual({foo: 4, bar: {bizz: [5, {buddy: 10, id: 2, cow: 4, snippy: 1}], buzz: 7}});
  });

  test('mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight', () => {
    const itemMatchBy = (v, k) => R.when(isObject, R.propOr(null, 'id'))(v);
    const renameSnippy = (left, right, seen = []) => {
      // Don't merge arrays
      if (R.all(Array.isArray, [left, right])) {
        return right;
      }

      // Recurse on each item usual, but rename snippy to snappy
      const rename = renameKey(R.lensPath([]), 'snippy', 'snappy');
      return R.mergeWithKey(
        (kk, ll, rr) => {
          // Calling the internal function here so we can pass kk and seen
          return _mergeDeepWithRecurseArrayItemsByRight(
            itemMatchBy,
            renameSnippy,
            ll,
            rr,
            kk,
            seen
          );
        },
        rename(left),
        rename(right)
      );
    };
    expect(
      omitDeep(['recursive'],
        mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight(
          itemMatchBy,
          renameSnippy,
          {
            foo: 1,
            bar: {bizz: [{buddy: 2, id: 2, cow: 4}, {brewer: 9}], buzz: 7},
            noids: [{pasta: 'elbow'}, {recursive}],
            noid: {sneeze: 'guard'}
          },
          {
            foo: 4,
            bar: {bizz: [5, {buddy: 10, id: 2, snippy: 1}]},
            noids: [{pasta: 'noodle'}, {pasta: 'leg'}, {recursive}],
            noid: {sneeze: 'free'}
          }
        ))).toEqual({
      foo: 4,
      bar: {bizz: [5, {buddy: 10, id: 2, cow: 4, snappy: 1}], buzz: 7},
      noids: [{pasta: 'noodle'}, {pasta: 'leg'}, {}],
      noid: {sneeze: 'free'}
    });
  });

  test('mergeDeepWithRecurseArrayItemsByRightHandlNull', () => {
    expect(mergeDeepWithRecurseArrayItemsByRight(
      () => {
      },
      {fever: 1},
      null
    )).toEqual({fever: 1});

    expect(mergeDeepWithRecurseArrayItemsByRight(
      () => {
      },
      [1],
      null
    )).toEqual([1]);
  });

  test('mergeDeepWithRecurseArrayItemsAndMapObjs', () => {
    expect(mergeDeepWithKeyWithRecurseArrayItemsAndMapObjs(
      (l, r) => R.when(
        R.is(Number),
        R.add(l)
      )(r),
      // key is null at the top level
      (key, obj) => key ? R.mergeRight({key: R.toUpper(key.toString())}, obj) : obj,
      {foo: 1, bar: {bizz: [2, {brewer: 9}], buzz: 7}},
      {foo: 4, bar: {bizz: [5, {brewer: 10}]}}
    )).toEqual({foo: 5, bar: {key: 'BAR', bizz: [7, {brewer: 19, key: 'BIZZ'}], buzz: 7}});
  });

  test('Should merge deep all objects', () => {
    expect(mergeDeepAll([
      {foo: 1, bar: {bizz: [2, 3], buzz: 7}},
      {foo: 4, bar: {bizz: [5, 6]}},
      {foo: 4, bar: {cat: [5, 6], pterodactyl: 'time is running out!'}}
    ])).toEqual(
      {foo: 4, bar: {bizz: [5, 6], buzz: 7, cat: [5, 6], pterodactyl: 'time is running out!'}}
    );
  });

  test('Should capitalize first letter', () => {
    expect(capitalize('good grief')).toEqual('Good grief');
  });

  test('Should merge all with key', () => {
    expect(
      mergeAllWithKey(
        (k, l, r) => k === 'a' ? R.concat(l, r) : r,
        [{a: [1], b: 2}, {a: [2], c: 3}, {a: [3]}]
      )).toEqual({a: [1, 2, 3], b: 2, c: 3});
  });

  test('mapKeys', () => {
    expect(mapKeys(
      key => `${capitalize(key)} Taco`,
      {fish: 'good', puppy: 'bad'})
    ).toEqual(
      {['Fish Taco']: 'good', ['Puppy Taco']: 'bad'}
    );
  });

  test('mapKeysForLens', () => {
    expect(mapKeysForLens(
        R.lensPath(['x', 1, 'y']),
        key => `${capitalize(key)} Taco`,
        {x: [null, {y: {fish: 'good', puppy: 'bad'}}]}
      )
    ).toEqual(
      {x: [null, {y: {['Fish Taco']: 'good', ['Puppy Taco']: 'bad'}}]}
    );
  });

  test('mapDefault should rename the default import', () => {
    expect(mapDefault('friend', {default: 'foo', other: 'boo'})).toEqual(
      {friend: 'foo', other: 'boo'}
    );
  });

  test('mapDefaultAndPrefixOthers should rename the default and prefix others', () => {
    expect(mapDefaultAndPrefixOthers('friend', 'prefix', {default: 'foo', other: 'boo'})).toEqual(
      {friend: 'foo', prefixOther: 'boo'}
    );
  });

  test('transformKeys', () => {
    expect(transformKeys(
      camelCase,
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
      renameKey(R.lensPath(['x', 'y']), 'z', 'and per se', {x: {y: {z: {cactus: 'blossoms'}}}})
    ).toEqual(
      {x: {y: {'and per se': {cactus: 'blossoms'}}}}
    );
  });

  test('duplicateKey', () => {
    expect(
      duplicateKey(R.lensPath(['x', 'y']), 'z', ['and per se', 'a per se', 'o per se'], {x: {y: {z: {cactus: 'blossoms'}}}})
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
    expect(
      duplicateKey(R.lensPath(['x', 'y']), 'z', 'and per se', {x: {y: {z: {cactus: 'blossoms'}}}})
    ).toEqual(
      {
        x: {
          y: {
            z: {cactus: 'blossoms'},
            'and per se': {cactus: 'blossoms'}
          }
        }
      }
    );
  });

  test('moveToKeys', () => {
    expect(
      moveToKeys(R.lensPath(['x', 'y']), 'z', ['and per se', 'a per se', 'o per se'], {x: {y: {z: {cactus: 'blossoms'}}}})
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
      findOne(R.equals('Eli Whitney'), {a: 1, b: 'Eli Whitney'})
    ).toEqual(
      Result.Ok({b: 'Eli Whitney'})
    );

    // Works with arrays
    expect(
      findOne(R.equals('Eli Whitney'), [1, 'Eli Whitney'])
    ).toEqual(
      Result.Ok(['Eli Whitney'])
    );

    // None
    expect(
      findOne(R.equals('Eli Whitney'), {a: 1, b: 2})
    ).toEqual(
      Result.Error({all: {a: 1, b: 2}, matching: {}})
    );

    // Too many
    expect(
      findOne(R.equals('Eli Whitney'), {a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Result.Error({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('onlyOne', () => {
    expect(onlyOne({a: 'Eli Whitney'})).toEqual(Result.Ok({a: 'Eli Whitney'}));

    // None
    expect(
      onlyOne({})
    ).toEqual(
      Result.Error({all: {}, matching: {}})
    );

    // Too many
    expect(
      onlyOne({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Result.Error({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('onlyOneValue', () => {
    expect(onlyOneValue({a: 'Eli Whitney'})).toEqual(Result.Ok('Eli Whitney'));

    // None
    expect(
      onlyOneValue({})
    ).toEqual(
      Result.Error({all: {}, matching: {}})
    );

    // Too many
    expect(
      onlyOneValue({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toEqual(
      Result.Error({all: {a: 'Eli Whitney', b: 'Eli Whitney'}, matching: {a: 'Eli Whitney', b: 'Eli Whitney'}})
    );
  });

  test('mapToObjValue', () => {
    expect(mapToObjValue(R.compose(camelCase, R.toLower), ['MY', 'SHOES_FIT'])).toEqual({
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
    expect(findOneValueByParams(params, items)).toEqual(
      Result.Ok({brand: 'crush', flavor: 'orange'})
    );
    const badParams = {brand: 'crush', flavor: 'pretzel'};
    expect(findOneValueByParams(badParams, items)).toEqual(
      Result.Error(
        {
          all: [{brand: 'crush', flavor: 'grape'}, {
            brand: 'fanta',
            flavor: 'strawberry'
          }, {brand: 'crush', flavor: 'orange'}], matching: []
        }
      )
    );
    const tooGoodParams = {brand: 'crush'};
    expect(findOneValueByParams(tooGoodParams, items)).toEqual(
      Result.Error(
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

  test('findByParams', () => {
    const items = [
      {brand: 'crush', flavor: 'grape'},
      {brand: 'fanta', flavor: 'strawberry'},
      {brand: 'crush', flavor: 'orange'}
    ];
    const params = {brand: 'crush', flavor: 'orange'};
    expect(findByParams(params, items)).toEqual(
      [{brand: 'crush', flavor: 'orange'}]
    );
    const badParams = {brand: 'crush', flavor: 'pretzel'};
    expect(findByParams(badParams, items)).toEqual(
      []
    );
    const tooGoodParams = {brand: 'crush'};
    expect(findByParams(tooGoodParams, items)).toEqual(
      [
        {brand: 'crush', flavor: 'grape'},
        {brand: 'crush', flavor: 'orange'}
      ]
    );
    // With objs
    const objs = {a: {foo: 1}, b: {foo: 2}};
    expect(findByParams({foo: 2}, objs)).toEqual({b: {foo: 2}});
  });

  test('findMapped', () => {
    expect(findMapped(R.prop('fri'), [{a: 1}, {b: 2}, {fri: 0}, {fi: 'willy'}, {fra: 4}])).toEqual(0);
  });

  test('findMappedAndResolve', () => {
    expect(
      findMappedAndResolve(
        R.prop('fri'),
        R.prop('pickle'),
        [{a: 1}, {b: 2}, {fri: 0, pickle: 'herring'}, {fi: 'willy'}, {fra: 4}]
      )
    ).toEqual('herring');
  });

  test('setMatchingMappedBoolAndResolve', () => {
    expect(
      setMatchingMappedBoolAndResolve(
        item => R.propEq('pickle', 'herring', item),
        (trueFalse, item) => R.set(R.lensPath(['puppy', 'smell']), trueFalse, item),
        [
          {a: 1, puppy: {smell: true}},
          {b: 2, puppy: {smell: false}},
          {
            fri: 0,
            pickle: 'herring',
            puppy: {smell: false}
          },
          {fi: 'willy'},
          {fra: 4}]
      )
    ).toEqual([
        {a: 1, puppy: {smell: false}},
        {b: 2, puppy: {smell: false}},
        {
          fri: 0,
          pickle: 'herring',
          puppy: {smell: true}
        },
        {fi: 'willy', puppy: {smell: false}},
        {fra: 4, puppy: {smell: false}}
      ]
    );
  });

  test('alwaysFunc', () => {
    const alwaysIWannaFuncWithYou = R.identity;
    const str = 'and make believe with you';
    expect(alwaysFunc(alwaysIWannaFuncWithYou)('and live in harmony')).toEqual('and live in harmony');
    expect(alwaysFunc(str)(1, 1, 'was', 'a racehorse')).toEqual(str);
  });

  test('mapKeysAndValues', () => {
    const obj = {neun: 'und_neinzig', luft: 'balons'};
    expect(mapKeysAndValues((v, k) => [capitalize(k), camelCase(v)], obj)).toEqual(
      {Neun: 'undNeinzig', Luft: 'balons'}
    );
  });

  test('fromPairsDeep', () => {
    // Outer element is non-pair array
    const deepPairs = [
      'Here',
      'come',
      'some',
      'pairs:',
      // This element is an array of pairs
      [
        ['I', [
          ['A', [
            ['i', [
              // Some deep non-pair arrays
              ['a', [1, 1, 'was', 'a', 'racehorse']],
              ['b', [2, 2, 'was', 1, 2]],
              ['c', {'I\'m': 'already an object!'}]
            ]],
            ['ii', [
              ['d', 4],
              ['e', 5],
              ['f', 6]
            ]]
          ]]
        ]]
      ]
    ];
    expect(fromPairsDeep(deepPairs)).toEqual(
      [
        'Here',
        'come',
        'some',
        'pairs:',
        {
          I: {
            A: {
              i: {
                a: [1, 1, 'was', 'a', 'racehorse'],
                b: [2, 2, 'was', 1, 2],
                c: {'I\'m': 'already an object!'}
              },
              ii: {
                d: 4,
                e: 5,
                f: 6
              }
            }
          }
        }
      ]
    );
    /*
    TODO does not work
    expect(fromPairsDeep([[
      "Kenya__Nairobi",
      [
        "2231585",
        {
          x: { o: 1 },
          "location": {
            "id": 2231585
          }
        }
      ]
    ])).toEqual(1)
     */
  });

  test('replaceValuesAtDepth', () => {
    // Test various depths
    expect(
      replaceValuesAtDepth(3, '...', {a: {A: {å: 1}, kitty: 2}})
    ).toEqual({a: {A: {å: '...'}, kitty: 2}});
    expect(
      replaceValuesAtDepth(2, '...', {a: {A: {å: 1}}, kitty: 2})
    ).toEqual({a: {A: '...'}, kitty: 2});
    expect(
      replaceValuesAtDepth(1, '...', {a: {A: {å: 1}}})
    ).toEqual({a: '...'});
    expect(
      replaceValuesAtDepth(0, '...', {a: {A: {å: 1}}})
    ).toEqual('...');

    // Test arrays
    expect(replaceValuesAtDepth(2, '...', [['A', ['a']], 'b'])).toEqual([['...', '...'], 'b']);

    // Test replacement function that takes length of objects and leaves primitives alone
    expect(
      replaceValuesAtDepth(3, R.when(isObject, R.compose(R.length, R.keys)), {
        a: {
          A: {
            å: [1, 2, 3],
            moo: {cow: 'yes', sheep: 'no'},
            ø: 'æ'
          }, kitty: 2
        }
      })
    ).toEqual({a: {A: {å: 3, moo: 2, ø: 'æ'}, kitty: 2}});
  });

  test('replaceValuesWithCountAtDepth', () => {
    expect(
      replaceValuesWithCountAtDepth(3, {a: {A: {å: [1, 2, 3], moo: {cow: 'yes', sheep: 'no'}, ø: 'æ'}, kitty: 2}})
    ).toEqual({a: {A: {å: '[...3]', moo: '{...2}', ø: 'æ'}, kitty: 2}});
  });

  test('replaceValuesAtDepthAndStringify', () => {
    expect(
      replaceValuesAtDepthAndStringify(3, '...', {a: {A: {å: 1}}})
    ).toEqual('{"a":{"A":{"å":"..."}}}');
  });

  test('mapObjToValues', () => {
    // Make sure values aren't flattened
    expect(mapObjToValues(R.ap([R.add(1)]), {a: [1], b: [2, 3]})).toEqual([[2], [3, 4]]);
  });

  test('filterObjToValues', () => {
    // Make sure values aren't flattened
    expect(filterObjToValues((v, k) => k !== 'toto', {dorothy: 1, toto: 2})).toEqual([1]);
  });

  test('chainObjToValues', () => {
    // Make sure values aren't flattened more than one level
    expect(chainObjToValues(R.ap([R.concat([1])]), {
      a: [[1]],
      b: [[2, 3], [4, 5]]
    })).toEqual([[1, 1], [1, 2, 3], [1, 4, 5]]);
  });

  test('flattenObj', () => {
    const f = () => 'func you';
    const banana = {};
    const a = {apple: banana};
    banana.a = a;

    // Survives functions and circular references
    expect(flattenObj({a, f})).toEqual({'a.apple': banana, f});
    expect(flattenObj({a: 1})).toEqual({a: 1});
    expect(flattenObj({a: 1, b: {johnny: 'b good'}})).toEqual({a: 1, 'b.johnny': 'b good'});
    expect(flattenObj(
      {a: 1, b: {johnny: 'b good', sam: [1, 2, 3]}}
    )).toEqual(
      {a: 1, 'b.johnny': 'b good', 'b.sam.0': 1, 'b.sam.1': 2, 'b.sam.2': 3}
    );
    expect(flattenObj([1, 2, 3])).toEqual({0: 1, 1: 2, 2: 3});
    expect(flattenObj([1, 2, 3])).toEqual({0: 1, 1: 2, 2: 3});
    expect(flattenObj({
      fi: {
        jojo: [
          {
            equals: 1
          }
        ]
      }
    })).toEqual({'fi.jojo.0.equals': 1});
  });

  test('flattenObjUntil', () => {
    expect(flattenObjUntil(R.propOr(false, 'cow'),
      {a: 1, b: {johnny: 'b good', c: {cow: {pie: true}}, sam: [1, 2, 3]}}
    )).toEqual(
      {a: 1, 'b.johnny': 'b good', 'b.c': {cow: {pie: true}}, 'b.sam.0': 1, 'b.sam.1': 2, 'b.sam.2': 3}
    );

    expect(flattenObjUntil(Array.isArray,
      {a: 1, b: {johnny: 'b good', sam: [1, 2, 3]}}
    )).toEqual(
      {a: 1, 'b.johnny': 'b good', 'b.sam': [1, 2, 3]}
    );
  });

  test('unflattenObj', () => {
    const pancake = R.compose(unflattenObj, flattenObj);
    const x = [
      {
        id: '2226274',
        country: 'Norway'
      }
    ];
    expect(pancake(x)).toEqual(x);

    expect(pancake({a: 1})).toEqual({a: 1});
    expect(pancake({a: 1, b: {johnny: 'b good'}})).toEqual({a: 1, b: {johnny: 'b good'}});
    expect(pancake({a: 1, b: {johnny: 'b good', sam: [1, 2, 3]}})).toEqual(
      {a: 1, b: {johnny: 'b good', sam: [1, 2, 3]}}
    );
  });

  test('unflattenObjNoArrays', () => {
    const pancake = R.compose(unflattenObjNoArrays, flattenObj);
    const x = [
      {
        id: '2226274',
        country: 'Norway'
      }
    ];
    expect(pancake(x)).toEqual({0: x[0]});

    expect(pancake({a: 1})).toEqual({a: 1});
    expect(pancake({a: 1, b: {johnny: 'b good'}})).toEqual({a: 1, b: {johnny: 'b good'}});
    expect(pancake({a: 1, b: {johnny: 'b good', sam: [1, 2, 3]}})).toEqual(
      {a: 1, b: {johnny: 'b good', sam: {0: 1, 1: 2, 2: 3}}}
    );
  });


  test('overDeep', () => {
    const res = overDeep(
      // Keep is null at the top level
      (k, v) => k ? R.mergeRight({butter: `${R.toUpper(k.toString())} Butter`})(v) : v,
      {
        peanut: {
          almond: {
            cashew: {
              brazilNut: {}
            },
            filbert: [
              {
                walnut: {},
                pecan: {}
              }
            ]
          }
        }
      }
    );
    expect(res.peanut.almond.cashew.brazilNut).toEqual({butter: 'BRAZILNUT Butter'});
    expect(res.peanut.almond.butter).toEqual('ALMOND Butter');
  });

  test('omitDeepBy', () => {
    const whatTheFunc = () => {
      return 'what the func';
    };

    const res = omitDeepBy(
      (k, v) => R.startsWith('_')(k),
      {
        peanut: {
          recursive,
          almond: {
            cashew: {
              _brazilNut: {},
              pecan: [
                {are: {the: {_best: true}}}
              ]
            },
            _filbert: [
              {
                walnut: {}
              }
            ]
          }
        },
        funkyNut: {
          wingnut: 'yes',
          cornnut: whatTheFunc
        }
      }
    );
    expect(omitDeepPaths(['peanut.recursive'], res)).toEqual({
      peanut: {
        almond: {
          cashew: {
            pecan: [
              {are: {the: {}}}
            ]
          }
        }
      },
      funkyNut: {
        wingnut: 'yes',
        cornnut: whatTheFunc
      }
    });
    const res2 = omitDeepBy(
      (k, v) => R.startsWith('_')(k),
      {
        _peanut: {
          almond: {
            cashew: {
              _brazilNut: {}
            },
            _filbert: [
              {
                walnut: {},
                pecan: {}
              }
            ]
          }
        }
      }
    );
    expect(res2).toEqual({});
  });

  test('omitDeepByNullsStayNull', () => {
    const obj = {
      viewport: {
        latitude: null,
        longitude: null,
        zoom: 1
      }
    };
    expect(omitDeepBy(R.startsWith('_'), obj)).toEqual(
      obj
    );
  });

  test('keyStringToLensPath', () => {
    expect(keyStringToLensPath('foo.bar.0.wopper')).toEqual(['foo', 'bar', 0, 'wopper']);
  });

  test('omitDeep', () => {
    const tricky = {
      urlObjSpots: [],
      location: {},
      routeResponses: [
        {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            date: 'Tue, 28 May 2019 13:22:04 GMT',
            expires: 'Wed, 29 May 2019 13:22:04 GMT',
            'cache-control': 'public, max-age=86400',
            server: 'mafe',
            'x-xss-protection': '0',
            'x-frame-options': 'SAMEORIGIN',
            'server-timing': 'gfet4t7; dur=57',
            'alt-svc': 'quic=":443"; ma=2592000; v="46,44,43,39"',
            'accept-ranges': 'none',
            vary: 'Accept-Language,Accept-Encoding',
            connection: 'close'
          }
        },
        {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            date: 'Tue, 28 May 2019 13:22:04 GMT',
            expires: 'Wed, 29 May 2019 13:22:04 GMT',
            'cache-control': 'public, max-age=86400',
            server: 'mafe',
            'x-xss-protection': '0',
            'x-frame-options': 'SAMEORIGIN',
            'server-timing': 'gfet4t7; dur=74',
            'alt-svc': 'quic=":443"; ma=2592000; v="46,44,43,39"',
            'accept-ranges': 'none',
            vary: 'Accept-Language,Accept-Encoding',
            connection: 'close'
          }
        }
      ]
    };
    expect(omitDeep(
      ['date', 'expires'],
      tricky
    )).toEqual(
      {
        urlObjSpots: [],
        location: {},
        routeResponses: [
          {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=UTF-8',
              'cache-control': 'public, max-age=86400',
              server: 'mafe',
              'x-xss-protection': '0',
              'x-frame-options': 'SAMEORIGIN',
              'server-timing': 'gfet4t7; dur=57',
              'alt-svc': 'quic=":443"; ma=2592000; v="46,44,43,39"',
              'accept-ranges': 'none',
              vary: 'Accept-Language,Accept-Encoding',
              connection: 'close'
            }
          },
          {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=UTF-8',
              'cache-control': 'public, max-age=86400',
              server: 'mafe',
              'x-xss-protection': '0',
              'x-frame-options': 'SAMEORIGIN',
              'server-timing': 'gfet4t7; dur=74',
              'alt-svc': 'quic=":443"; ma=2592000; v="46,44,43,39"',
              'accept-ranges': 'none',
              vary: 'Accept-Language,Accept-Encoding',
              connection: 'close'
            }
          }
        ]
      }
    );
  });

  test('omitDeepNull', () => {
    const json = {
      data: {
        regions: [
          {
            __typename: 'RegionType',
            id: 1,
            deleted: null,
            key: 'MyBuddy',
            name: 'My Buddy',
            createdAt: '2019-01-01T10:11:44.051507+00:00',
            updatedAt: '2020-03-31T10:44:47.012902+00:00',
            geojson: {
              __typename: 'FeatureCollectionDataType',
              type: 'FeatureCollection',
              features: [
                {
                  __typename: 'FeatureDataType',
                  type: 'Feature',
                  id: null,
                  geometry: {
                    __typename: 'FeatureGeometryDataType',
                    type: 'Polygon',
                    coordinates: [
                      [
                        [
                          49.5294835476,
                          2.51357303225
                        ],
                        [
                          51.4750237087,
                          2.51357303225
                        ],
                        [
                          51.4750237087,
                          6.15665815596
                        ],
                        [
                          49.5294835476,
                          6.15665815596
                        ],
                        [
                          49.5294835476,
                          2.51357303225
                        ]
                      ]
                    ]
                  },
                  properties: null
                }
              ],
              generator: null,
              copyright: null
            },
            data: {
              __typename: 'RegionDataType',
              locations: {
                __typename: 'RegionsLocationDataType',
                params: null
              },
              mapbox: {
                __typename: 'MapboxDataType',
                viewport: {
                  __typename: 'ViewportDataType',
                  latitude: null,
                  longitude: null,
                  zoom: 10
                }
              }
            }
          }
        ]
      },
      loading: false,
      networkStatus: 7,
      stale: false
    };
    expect(omitDeep(['createdAt', 'updatedAt'], json).data.regions[0].createdAt).toEqual(undefined); // eslint-disable-line no-undefined
    expect(omitDeep(['createdAt', 'updatedAt'], json).data.regions[0].deleted).toEqual(null);
  });

  test('omitDeepPaths', () => {
    expect(
      R.compose(
        // This is here to remove the remaining recursive object so comparison works
        res => omitDeepPaths(['boo.recursive'], res),
        // Omit these paths
        x => omitDeepPaths(['foo.bunny', 'boo.funny.foo.sunny.2', 'boo.funny.foo.sunny.1.4.go'], x)
      )(
        {
          foo: {
            bunny: {
              humorous: 'stuff',
              recursive
            }
          },
          boo: {
            recursive,
            funny: {
              foo: {
                sunny: [
                  8,
                  [10,
                    'more',
                    'miles',
                    'to',
                    {
                      go: 'teo',
                      wo: 1
                    }
                  ], 9
                ]
              },
              soo: 3
            }
          }
        }
      )
    ).toEqual(
      {
        foo: {},
        boo: {
          funny: {
            foo: {
              sunny: [
                8, [
                  10,
                  'more',
                  'miles',
                  'to', {
                    wo: 1
                  }
                ]
              ]
            },
            soo: 3
          }
        }
      }
    );
  });

  test('omitDeepBug', () => {
    const buggy = {
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'node/248124950',
            geometry: {
              type: 'Point',
              coordinates: [
                -115.0646702,
                49.5161346
              ]
            },
            properties: {
              id: 248124950,
              meta: {},
              tags: {},
              type: 'node',
              relations: []
            },
            __typename: {}
          }
        ]
      }
    };
    expect(R.propOr('great', '__typename', reqStrPathThrowing('geojson.features.0', omitDeep(['__typename'], buggy)))).toEqual('great');
  });

  test('pickDeepPaths', () => {
    expect(pickDeepPaths(
      ['foo.bunny',
        'boo.funny.foo.sunny.2',
        'boo.funny.foo.sunny.1.4.go',
        'coo.moo.*.cow./[1|6]/.*.forever'
      ],
      {
        foo: {bunny: {humorous: 'stuff'}},
        boo: {funny: {foo: {sunny: [8, [10, 'more', 'miles', 'to', {go: 'teo', wo: 1}], 9]}, soo: 3}},
        coo: {
          moo: [
            1,
            2,
            {
              cow: [
                'come',
                {me: {forever: 'hers'}, never: 'mine'},
                'baby',
                'say',
                {me: {forever: 'his'}, never: 'mine'},
                'love',
                {me: {forever: 'yours'}, never: 'mine'}
              ]
            },
            4
          ]
        }
      }
    )).toEqual(
      {
        foo:
          {
            bunny: {humorous: 'stuff'}
          },
        boo: {
          funny: {
            foo: {
              sunny: [[{go: 'teo'}], 9]
            }
          }
        },
        coo: {
          moo: [{cow: [{me: {forever: 'hers'}}, {me: {forever: 'yours'}}]}]
        }
      }
    );
  });

  test('camelCase', () => {
    expect(camelCase('Tough_Mudder_Hubbard')).toEqual('toughMudderHubbard');
  });

  test('splitAtInclusive', () => {
    expect(splitAtInclusive(1, [1, 2, 3, 4, 5])).toEqual(
      [[1, 2], [2, 3, 4, 5]]
    );
    expect(splitAtInclusive(0, [1, 2, 3, 4, 5])).toEqual(
      [[1], [1, 2, 3, 4, 5]]
    );
    expect(splitAtInclusive(-1, [1, 2, 3, 4, 5])).toEqual(
      [[1, 2, 3, 4, 5], [5]]
    );
    expect(splitAtInclusive(1, 'murderforajarofredrum')).toEqual(
      ['mu', 'urderforajarofredrum']
    );
  });


  test('toArrayIfNot', () => {
    const eh = ['eh'];
    expect(toArrayIfNot(eh)).toBe(eh);
    expect(toArrayIfNot('eh')).toEqual(eh);
  });
});
