import {
  eqStrPathsAllCustomizable,
  eqStrPathsAll,
  eqStrPath,
  hasStrPath,
  pathOr,
  reqPathPropEq,
  reqStrPath,
  strPath,
  strPathOrNullOk,
  strPathsOr,
  strPathsOrNullOk,
  strPathTruthyOr, strPathEq, eqAsSetsWith
} from './propPathFunctions.js';
import Result from 'folktale/result/index.js';
import * as R from 'ramda';
import {strPathOr} from "./strPathOr.js";
import {reqPath} from "./reqPath.js";

describe('propPathFunctions', () => {
  test('Required path', () => {
    expect(reqPath(['a'], {a: 1}).value).toBe(1);
    expect(reqPath(['a', 'b'], {a: {c: 1}}).value).toEqual({
      resolved: ['a'],
      path: ['a', 'b']
    });
  });

  test('Should reqPath of object', () => {
    expect(
      reqPath(['a', 'b', 1, 'c'], {a: {b: [null, {c: 2}]}})
    ).toEqual(Result.Ok(2));
  });
  test('strPathEq', () => {
    expect(strPathEq('jolly.rogers.0.candy', 'red', {jolly: {rogers: [{candy: 'red'}]}})).toBeTruthy();
    expect(strPathEq('jolly.rogers.0.candy', 'blue', {jolly: {rogers: [{candy: 'red'}]}})).toBeFalsy();
    expect(strPathEq('0.jolly.rogers.0.candy', 'red', [{jolly: {rogers: [{candy: 'red'}]}}])).toBeTruthy();
    expect(strPathEq('0.jolly.rogers.0.candy', 'blue', [{jolly: {rogers: [{candy: 'red'}]}}])).toBeFalsy();
  });

  test('reqStrPath', () => {
    expect(reqStrPath('foo.bar.goo', {
      foo: {
        bar: {
          goo: 1
        }
      }
    })).toEqual(Result.Ok(1));

    expect(reqStrPath('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toEqual(Result.Error(
      {
        resolved: ['foo'],
        path: ['foo', 'bar', 'goo']
      })
    );
  });

  test('strPath', () => {
    expect(strPath('foo.bar.goo', {
      foo: {
        bar: {
          goo: 1
        }
      }
    })).toEqual(1);

    expect(typeof strPath('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toEqual('undefined');
  });

  test('strPathOr', () => {
    expect(strPathOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(false);
    expect(strPathOr(1, 'tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(1);
  });

  test('pathOr', () => {
    expect(pathOr(1, ['tan', 'khaki', 'pants'], {tan: {khaki: {pants: false}}})).toEqual(false);
    expect(pathOr(1, ['tan', 'khaki', 'blazer'], {tan: {khaki: {pants: false}}})).toEqual(1);
  });

  test('strPathsOr', () => {
    expect(strPathsOr(1, ['tan.khaki.pants', 'tan.khaki.blazer'], {tan: {khaki: {pants: false}}})).toEqual([false, 1]);
  });

  test('strPathTruthyOr', () => {
    expect(strPathTruthyOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: null}}})).toEqual(1);
    expect(strPathTruthyOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: 0}}})).toEqual(1);
    expect(strPathTruthyOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(1);
    expect(strPathTruthyOr(1, 'tan.khaki.pants', {tan: {khaki: {pants: 'cookie'}}})).toEqual('cookie');
    expect(strPathTruthyOr(1, 'tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(1);
    expect(strPathTruthyOr(1, 'tan.khaki.blazer', {tan: {khaki: 'cabbage'}})).toEqual(1);
  });

  test('strPathOrNullOk', () => {
    expect(strPathOrNullOk(1, 'tan.khaki.pants', {tan: {khaki: {pants: null}}})).toEqual(null);
    expect(strPathOrNullOk(1, 'tan.khaki.pants', {tan: {khaki: {pants: 0}}})).toEqual(0);
    expect(strPathOrNullOk(1, 'tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(false);
    expect(strPathOrNullOk(1, 'tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(1);
    expect(strPathOrNullOk(1, 'tan.khaki.blazer', {tan: {khaki: 'cabbage'}})).toEqual(1);
  });

  test('strPathsOrNullOk', () => {
    expect(strPathsOrNullOk(1, ['tan.khaki.pants', 'tan.khaki.blazer', 'tan.khaki.kite'], {
      tan: {
        khaki: {
          pants: null,
          kite: 'charlie'
        }
      }
    })).toEqual([null, 1, 'charlie']);
  });

  test('hasStrPath', () => {
    expect(hasStrPath('tan.khaki.pants', {tan: {khaki: {pants: false}}})).toEqual(true);
    expect(hasStrPath('tan.khaki.blazer', {tan: {khaki: {pants: false}}})).toEqual(false);
  });

  test('Required path prop equals', () => {
    expect(reqPathPropEq(['a'], 1, {a: 1}).value).toBe(true);
    expect(reqPathPropEq(['a', 'b'], 1, {a: {c: 1}}).value).toEqual({
      resolved: ['a'],
      path: ['a', 'b']
    });
  });

  test('eqStrPath', () => {
    expect(eqStrPath('bubble.gum.0.soup',
      {bubble: {gum: [{soup: 'banana'}]}},
      {bubble: {gum: [{soup: 'banana'}]}}
    )).toEqual(true);
    expect(eqStrPath('bubble.gum.soup',
      {bubble: {gum: {soup: 'banana'}}},
      {bubble: {gum: {soup: 'goat'}}}
    )).toEqual(false);
  });

  test('eqStrPathsAll', () => {
    expect(eqStrPathsAll(['a', 'b'], {a: 1, b: 2, c: 3}, {a: 1, b: 2, c: 'hubabalu'})).toEqual(true);
    expect(eqStrPathsAll(['a', 'b', 'c'], {a: 1, b: 2, c: 3}, {a: 1, b: 2, c: 'hubabalu'})).toEqual(false);
    expect(eqStrPathsAll(['a.goat', 'b'], {a: {goat: 1}, b: 2, c: 3}, {
      a: {goat: 1},
      b: 2,
      c: 'hubabalu'
    })).toEqual(true);
    expect(eqStrPathsAll(['a', 'b.pumpkin', 'c'], {a: 1, b: {pumpkin: null}, c: 3}, {
      a: 1,
      b: {pumpkin: null},
      c: 'hubabalu'
    })).toEqual(false);
  });

  test('eqStrPathsAllCustomizable', () => {
    expect(eqStrPathsAllCustomizable(
      ['a.goat', 'b', 'c'],
      {
        c: (sPath, obj1, obj2) => {
          // custom equality test
          return R.equals(
            R.prop(sPath, obj1),
            R.length(R.prop(sPath, obj2))
          );
        }
      },
      {a: {goat: 1}, b: 2, c: 3},
      {a: {goat: 1}, b: 2, c: 'hub'}
    )).toEqual(true);
  });
  test('eqAsSetsWith', () => {
    expect(eqAsSetsWith(R.identity, [1, 2, 3], [3, 2, 1])).toBe(true);
    expect(eqAsSetsWith(R.identity, [1, 2, 3], [3, 2, 1, 0])).toBe(false);
    expect(eqAsSetsWith(R.prop('go'), [{go: 1}, {go: 2}, {go: 3}], [{go: 3}, {go: 2}, {go: 1}])).toBe(true);
    expect(eqAsSetsWith(R.prop('go'), [{go: 1}, {go: 2}, {go: 3}], [{go: 3}, {go: 2}, {go: 4}])).toBe(false);
  });
});
