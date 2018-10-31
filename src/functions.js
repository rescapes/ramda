/**
 * Created by Andy Likuski on 2017.02.26
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/*
* Utility functions, which rely heavily on Ramda, data.task, and Ramda Fantasy types
* These functions should all be pure. Equivalent throwing functions can
* be found in throwingFunctions. throwingFunctions should only be used for coding errors,
* such as improper function arguments or an invalid path within object.
* I/O Errors should be handled using Maybe or Result and calling functions should expect them.
* An I/O Error should always result in a valid state of an application, even if that valid
* state is to show an error message, retry I/O, etc.
*/

import * as R from 'ramda';
import * as Rm from 'ramda-maybe';
import * as Result from 'folktale/result';

/**
 * Return an empty string if the given entity is falsy
 * @param {Object} entity The entity to check
 * @returns {String|Object} The empty string or the Object
 * @sig orEmpty:: a -> a
 *        :: a -> String
 */
export const orEmpty = entity => entity || '';

/**
 * Removed null or undefined items from an iterable
 * @param [a] items Items that might have falsy values to remove
 * @returns The compacted items
 * @sig compact:: [a] -> [a]
 * @sig compact:: {k,v} -> {k,v}
 */
export const compact = R.reject(R.isNil);

/**
 * Remove empty strings
 * @param [a] items Items that might have empty or null strings to remove
 * @returns The compacted items
 * @sig compactEmpty:: [a] -> [a]
 */
export const compactEmpty = R.reject(R.either(R.isNil, R.isEmpty));

/**
 * Convert an empty value to null
 * @param a item Item that might be empty according to isEmpty
 * @returns the
 * @sig emptyToNull:: a -> a
 *            :: a -> null
 */
export const emptyToNull = R.when(R.isEmpty, () => null);

/**
 * Join elements, first remove null items and empty strings. If the result is empty make it null
 * @param connector Join connector string
 * @param [a] items Items to join that might be removed
 * @sig compactEmpty:: [a] -> String
 *             :: [a] -> null
 */
export const compactJoin = R.compose(
  (connector, items) => R.pipe(compactEmpty, R.join(connector), emptyToNull)(items)
);

/**
 * Creates a partial mapping function that expects an iterable and maps each item of the iterable to the given property
 * @param {String} prop The prop of each object to map
 * @param {[Object]} items The objects to map
 * @returns {[Object]} The mapped objects
 * @sig mapProp :: String -> [{k, v}] -> [a]
 */
export const mapProp = R.curry((prop, objs) => R.pipe(R.prop, R.map)(prop)(objs));

/**
 * Creates a partial function that maps an array of objects to an object keyed by the given prop of the object's
 * of the array, valued by the item. If the item is not an array, it leaves it alone, assuming it is already indexed
 * @param {String} prop The prop of each object to use as the key
 * @param {[Object]} items The items to map
 * @returns {Object} The returned object
 * @sig mapPropValueAsIndex:: String -> [{k, v}] -> {j, {k, v}}
 * @sig mapPropValueAsIndex:: String -> {k, v} -> {k, v}
 */
export const mapPropValueAsIndex = R.curry((prop, obj) =>
  R.when(
    Array.isArray,
    R.pipe(R.prop, R.indexBy)(prop)
  )(obj));

/**
 * Merges a list of objects by the given key and returns the values, meaning all items that are
 * duplicate prop key value are removed from the final list
 * @returns {[Object]} The items without the duplicates
 * @sig removeDuplicateObjectsByProp:: String -> [{k, v}] -> [{k, v}]
 */
export const removeDuplicateObjectsByProp = R.curry((prop, list) =>
  R.pipe(
    mapPropValueAsIndex(prop),
    R.values
  )(list)
);

/**
 * Returns the id of the given value if it is an object or the value itself if it is not.
 * @param {Object|String|Number} objOrId
 * @returns {String|Number} an id
 * @sig idOrIdFromObj:: a -> a
 *              :: {k, v} -> a
 */
export const idOrIdFromObj = R.when(
  objOrId => (typeof objOrId === 'object') && objOrId !== null,
  R.prop('id')
);

/**
 * Deep merge values that are objects but not arrays
 * based on https://github.com/ramda/ramda/pull/1088
 * @params {Object} l the 'left' side object to merge
 * @params {Object} r the 'right' side object to merge
 * @type {Immutable.Map<string, V>|__Cursor.Cursor|List<T>|Map<K, V>|*}
 * @returns {Object} The deep-merged object
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
export const mergeDeep = R.mergeWith((l, r) => {
  // If either (hopefully both) items are arrays or not both objects
  // accept the right value
  return ((l && l.concat && R.is(Array, l)) || (r && r.concat && R.is(Array, r))) || !(R.is(Object, l) && R.is(Object, r)) ?
    r :
    mergeDeep(l, r); // tail recursive
});

/**
 * mergeDeep any number of objects
 * @params {[Object]} objs Array of objects to reduce
 * @returns {Object} The deep-merged objects
 */
export const mergeDeepAll = R.reduce(mergeDeep, {});

/**
 * Deep merge values with a custom function that are objects
 * based on https://github.com/ramda/ramda/pull/1088
 * @params {Function} fn The merge function left l, right r:: l -> r -> a
 * @params {Object} l the 'left' side object to merge
 * @params {Object} r the 'right' side object to morge
 * @returns {Object} The deep-merged objeck
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
export const mergeDeepWith = R.curry((fn, left, right) => R.mergeWith((l, r) => {
  // If either (hopefully both) items are arrays or not both objects
  // accept the right value
  return (
    (l && l.concat && R.is(Array, l)) ||
    (r && r.concat && R.is(Array, r))
  ) ||
  !(R.all(R.is(Object)))([l, r]) ||
  R.any(R.is(Function))([l, r]) ?
    fn(l, r) :
    mergeDeepWith(fn, l, r); // tail recursive
})(left, right));

/**
 * http://stackoverflow.com/questions/40011725/point-free-style-capitalize-function-with-ramda
 * Capitalize the first letter
 * @param {String} str The string to capitalize
 * @returns {String} The capitalized string
 * @sig capitalize:: String -> String
 */
export const capitalize = str => R.compose(
  R.join(''),
  R.juxt([R.compose(R.toUpper, R.head), R.tail])
)(str);

/**
 * http://stackoverflow.com/questions/40011725/point-free-style-capitalize-function-with-ramda
 * Lowercase the first letter
 * @param {String} str The string to lowercase
 * @returns {String} The capitalized string
 * @sig capitalize:: String -> String
 */
export const lowercase = str => R.compose(
  R.join(''),
  R.juxt([R.compose(R.toLower, R.head), R.tail])
)(str);

/**
 * From https://github.com/substack/camelize/blob/master/index.js
 * @param {String} str The string to camelCase
 * @returns {String} The camel-cased string
 */
export const camelCase = str =>
  str.replace(
    /[_.-](\w|$)/g,
    (_, x) => x.toUpperCase()
  );

/**
 * Merge a list of objects using the given concat function
 * [{k: v}] → {k: v}
 * @returns {Object} The merged object
 * @sig mergeAllWithKey:: (String → a → a → a) → [{a}] → {a}
 */
export const mergeAllWithKey = R.curry((fn, [head, ...rest]) =>
  R.mergeWithKey( // call mergeWithKey on two objects at a time
    fn,
    head || {}, // first object is always the head
    R.ifElse( // second object is the merged object of the recursion
      R.isEmpty, // if no rest
      () => R.empty({}), // end case empty object
      mergeAllWithKey(fn) // else recurse with the rest
    )(rest)
  )
);

/**
 * Get a required path or return a helpful Error if it fails
 * @param {String} path A lensPath, e.g. ['a', 'b'] or ['a', 2, 'b']
 * @param {Object} obj The object to inspect
 * @returns {Result} Result the resolved value or an Error
 * @sig reqPath:: String -> {k: v} → Result
 */
export const reqPath = R.curry((path, obj) => {
  return R.compose(
    R.ifElse(
      // If path doesn't resolve
      maybe => maybe.isNothing,
      // Create a useful Error message
      () => Result.Error({
        resolved: R.reduceWhile(
          // Stop if the accumulated segments can't be resolved
          (segments, segment) => R.not(R.isNil(R.path(R.concat(segments, [segment]), obj))),
          // Accumulate segments
          (segments, segment) => R.concat(segments, [segment]),
          [],
          path
        ),
        path: path
      }),
      // Return the resolved value
      res => Result.Ok(res.value)
    ),
    // Try to resolve the value using the path and obj, returning Maybe
    Rm.path(path)
  )(obj);
});

/**
 * Expects a prop path and returns a function expecting props,
 * which resolves the prop indicated by the string. Returns Result.Error if there is not match
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {Result} Result.Ok with the resolved value or Result.Error if the path doesn't exist or the
 * value is null
 */
export const reqStrPath = R.curry((str, props) => reqPath(R.split('.', str), props));

/**
 * Expects a prop path and returns a function expecting props,
 * which resolves the prop indicated by the string. If not match is found it returns undefined
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {Object} The resolved object or undefined
 */
export const strPath = R.curry((str, props) => {
  return R.view(R.lensPath(R.split('.', str)), props);
});

/**
 * Like strPath but defaults the given value
 * @param {Object} defaultValue. Default value if value is undefined. Falsy does not default
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {function(*=)}
 */
export const strPathOr = R.curry((defaultValue, str, props) => {
  const result = R.view(R.lensPath(R.split('.', str)), props);
  return R.when(
    R.equals(undefined), // eslint-disable-line no-undefined
    R.always(defaultValue)
  )(result);
});

/**
 * Returns true if the given string path is non-null
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @returns {Boolean} true
 */
export const hasStrPath = R.curry((str, props) =>
  R.complement(R.isNil)(
    R.view(R.lensPath(R.split('.', str)), props)
  )
);

/**
 * Uses reqPath to resolve the path of an object and compares it to val
 * @param {String} path A lensPath, e.g. ['a', 'b'] or ['a', 2, 'b']
 * @param {*} val The val to do an equality check on
 * @param {Object} obj The object to inspect
 * @returns {Result} Result the resolved value or an Error
 * @sig reqPath:: String -> {k: v} → Result
 */
export const reqPathPropEq = R.curry((path, val, obj) =>
  // If the reqPath is valid map it to a comparison with val
  reqPath(path, obj).map(R.equals(val))
);

/**
 * From the cookbook: https://github.com/ramda/ramda/wiki/Cookbook#map-keys-of-an-object
 * Maps keys according to the given function
 * @returns {Object} The mapped keys of the object
 * @sig mapKeys :: (String -> String) -> Object -> Object
 */
export const mapKeys = R.curry((fn, obj) =>
  R.fromPairs(R.map(R.adjust(fn, 0), R.toPairs(obj))));


/**
 * Uses a lens to map keys that are embedded in a data structure
 * The lens must indicate an object whose keys shall be mapped
 * @returns {Object} Object with the keys indicated by the given lens mapped
 * @sig mapKeysForLens :: Lens -> ((String -> String) -> Object -> Object
 */
export const mapKeysForLens = R.curry((lens, fn, obj) =>
  // Sets the lens-focused objects to a new object with keys mapped according to the function
  R.set(lens, mapKeys(fn, R.view(lens, obj)), obj)
);

/**
 * Converts default to desired name. Used for requiring defaults
 * @param {String} keyName The desired rename of 'default'
 * @param {Object} module A required module with a default key
 * @returns {Object} The import module with key default changed to keyName
 * @sig mapDefault :: String -> <k,v> -> <k,v>
 */
export const mapDefault = (keyName, module) => mapKeys(key => key === 'default' ? keyName : key, module);
/**
 * Converts default to desired name and prefixes others.
 * Used for requiring defaults and renaming others
 * @param {String} defaultName The desired rename of 'default'
 * @param {String} prefix The desired prefix for others. Camel Case maintained
 * @param {Object} module A required module with a default key
 * @returns {Object} The import module with key default changed to keyName
 * @sig mapDefault :: String -> <k,v> -> <k,v>
 */
export const mapDefaultAndPrefixOthers = (defaultName, prefix, module) =>
  mapKeys(
    key => (key === 'default') ? defaultName : `${prefix}${capitalize(key)}`,
    module
  );

/**
 * Maps a container with a function that returns pairs and create and object therefrom
 * Like R.mapObjIndexed, the function's first argument is the value of each item, and the seconds is the key if
 * iterating over objects
 * @params {Functor} f The mapping function
 * @params {Container} container Anything that can be mapped
 * @returns {Object} The mapped pairs made into key values
 * @sig fromPairsMap :: Functor F = (a -> [b,c]) -> F -> <k,v>
 */
export const fromPairsMap = R.curry((f, container) => R.fromPairs(R.mapObjIndexed(f, container)));

/**
 * https://github.com/ramda/ramda/wiki/Cookbook
 * Filter objects with values and keys
 * @param {Function} pred (value, key) => True|False
 * @param {Object} obj The object to filter
 * @returns {Object} The filtered object
 * @sig filterWithKeys:: (v -> k -> True|False) -> <k,v> -> <k,v>
 */
export const filterWithKeys = R.curry((pred, obj) => R.pipe(
  R.toPairs,
  R.filter(pair => R.apply(pred, R.reverse(pair))),
  R.fromPairs
  )(obj)
);

/**
 * Transforms the keys of the given object with the given func
 * @param {Function} func The mapping function that expects the key
 * @param {Object} The object to map
 * @returns {Object} The object with transformed keys and the original values
 */
export const transformKeys = R.curry((func, obj) =>
  R.compose(
    R.fromPairs,
    R.map(([key, value]) =>
      [func(key), value]),
    R.toPairs
  )(obj)
);

/**
 * Renames the key of the object specified by the lens
 * @param {Function} lens A ramda lens that points to the object containing the key, not the key itself
 * @param {String} from Key to rename
 * @param {String} to New name for the key
 * @param {Object} obj Object to traverse with the lens
 */
export const renameKey = R.curry((lens, from, to, obj) => R.over(
  lens,
  target => mapKeys(
    R.when(R.equals(from), R.always(to)),
    target),
  obj));

/**
 * Duplicates the key of the object specified by the lens and key, to the given list of keys.
 * A duplicate of the value at key will be added at each of the toKeys using R.clone
 * @param {Function} lens A ramda lens that points to the object containing the key, not the key itself
 * @param {String} key Key to duplicate the value of
 * @param [{String}] toKeys Array of new keys to make. New keys overwrite existing keys
 * @param {Object} obj Object to traverse with the lens
 */
export const duplicateKey = R.curry((lens, key, toKeys, obj) => R.over(
  lens,
  // convert the target of the lens to a merge of the target with copies of target[key]
  target => R.merge(
    target,
    R.fromPairs(
      R.map(
        toKey => [toKey, R.clone(target[key])],
        toKeys
      )
    )
  ),
  // take the lens of this obj
  obj)
);

/**
 * Like duplicateKey but removes the original key
 * @param {Function} lens A ramda lens that points to the object containing the key, not the key itself
 * @param {String} key Key to duplicate the value of
 * @param [{String}] toKeys Array of new keys to make. New keys overwrite existing keys
 * @param {Object} obj Object to traverse with the lens
 */
export const moveToKeys = R.curry((lens, key, toKeys, obj) => R.over(
  lens,
  // convert the target of the lens to a merge of the target with copies of target[key]
  // and with target[key] itself removed
  target => R.merge(
    R.omit([key], target),
    R.fromPairs(
      R.map(
        toKey => [toKey, R.clone(target[key])],
        toKeys
      )
    )
  ),
  // take the lens of this obj
  obj)
);

/**
 * Like R.find but expects only one match and works on both arrays and objects
 * Note this still iterates through the whole list or object, so this should be rewritten to quit when one is found
 * @param {Function} predicate
 * @param {Array|Object} obj Container that should only match once with predicate
 * @returns {Result} Result.Error if no matches or more than one, otherwise Result.Ok with the single matching item in an array/object
 */
export const findOne = R.curry((predicate, obj) =>
  R.ifElse(
    // If path doesn't resolve
    items => R.equals(R.length(R.keys(items)), 1),
    // Return the resolved single key/value object
    items => Result.Ok(items),
    // Create a useful Error message
    items => Result.Error({
      all: obj,
      matching: items
    })
  )(R.filter(predicate, obj))
);

/**
 * Version of find one that accepts all items of the given Container
 * @param {Array|Object} obj Container
 * @returns {Result} Result.Error if no items or more than one, otherwise Result.Ok with the single item in an array/object
 */
export const onlyOne = findOne(R.T);

/**
 * Like onlyOne but extracts the value
 * @param {Array|Object|Result} obj Container that should have one value to extract. This currently expects
 * and array or object or Result, but it could be expanded to take Result, Maybe, or any other container where
 * the value can be extracted. Types like Tasks and Streams can't extract, I suppose
 * @returns {Result} Result.Error if no items or more than one, otherwise Result.Ok with the single value
 */
export const onlyOneValue = R.compose(
  // Use R.map to operate on the value of Result without extracting it
  R.map(R.head),
  R.map(R.values),
  findOne(R.T)
);

/**
 * Curryable Maps container values to the key and values of an object, applying f to each to make the value
 * @param {Function} f Transforms each item to a value
 * @param {Array} list Container to map to an object.
 * @sig mapToObjValue:: Functor a => (b -> c) -> <b, c>
 */
export const mapToObjValue = R.curry((f, obj) => R.compose(R.fromPairs, R.map(v => [v, f(v)]))(obj));


/**
 * Finds an item that matches all the given props in params
 * @param {Object} params object key values to match
 * @param {Object|Array} items Object or Array that can produce values to search
 * @returns {Result} An Result.Ok containing the value or an Result.Error if no value is found
 */
export const findOneValueByParams = (params, items) => {
  return findOne(
    // Compare all the eqProps against each item
    R.allPass(
      // Create a eqProps for each prop of params
      R.map(prop => R.eqProps(prop, params),
        R.keys(params)
      )
    ),
    R.values(items)
  ).map(R.head);
};

/**
 * Converts the given value to an always function (that ignores all arguments) unless already a function
 * @param {Function} maybeFunc A function or something else
 * @return {Function} a function that always returns the non funcion value of maybeFunc, or maybeFunc
 * itself if maybeFunc is a functon
 */
export const alwaysFunc = maybeFunc => R.unless(R.is(Function), R.always)(maybeFunc);

/**
 * Map the object with a function accepting a key, value, and the obj but return just the mapped values,
 * not the object
 * @param {Function} f Expects value, key, and obj
 * @param {Object} obj The object to map
 * @return {[Object]} Mapped values
 */
export const mapObjToValues = (f, obj) => {
  return R.values(R.mapObjIndexed(f, obj));
};

/**
 * A version of traverse that also reduces. I'm sure there's something in Ramda for this, but I can't find it.
 * Same arguments as reduce, but the initialValue must be an applicative, like task.of({}) or Result.of({})
 * f is called with the underlying value of accumulated applicative and the underlying value of each list item,
 * which must be an applicative
 * @param {Function} accumulator Accepts a reduced applicative and each result of sequencer, then returns the new reduced applicative
 * @param {Object} initialValue An applicative to be the intial reduced value of accumulator
 * @param {[Object]} list List of applicatives
 * @returns {Object} The value resulting from traversing and reducing
 */
export const traverseReduce = (accumulator, initialValue, list) => R.reduce(
  (applicatorRes, applicator) => applicatorRes.chain(
    res => applicator.map(v => accumulator(res, v))
  ),
  initialValue,
  list
);

/**
 * A version of traverseReduce that also reduces until a boolean condition is met.
 * Same arguments as reduceWhile, but the initialValue must be an applicative, like task.of({}) or Result.of({})
 * f is called with the underlying value of accumulated applicative and the underlying value of each list item,
 * which must be an applicative
 * @param {Object|Function} predicateOrObj Like ramda's reduceWhile predicate. Accepts the accumulated value an next value.
 * These are the values of the container. If false is returned the accumulated value is returned without processing
 * more values. Be aware that for Tasks the task must run to predicate on the result, so plan to check the previous
 * task to prevent a certain task from running
 @param {Boolean} [predicateOrObj.accumulateAfterPredicateFail] Default false. Because of Tasks, we have a boolean here to allow accumulation after
 * the predicate fails. The default behavior is to not accumulate the value of a failed predicate. This makes
 * sense for things like Result where there is no consequence of evaluating them. But we have to run a Task to
 * evaluate it so, so we might want to quit after the previous task but also add that task result to the accumulation.
 * In that case set this tru
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
            // Done, wrap it in the type
            res => initialValue.map(R.always(R.prop('@@transducer/value', res))),
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
    // Strip reduced if if was returned on the last interation
    return initialValue.map(() => R.ifElse(
      R.prop('@@transducer/reduced'),
      res => R.prop('@@transducer/value', res),
      R.identity
    )(value));
  });
};

/**
 * Like mapObjToValues but flattens the values when an array is returned for each mapping
 * @param {Function} f Expects key, value, and obj
 * @param {Object} obj The object to chain
 * @return {[Object]} Mapped flattened values
 */
export const chainObjToValues = (f, obj) => {
  return R.flatten(mapObjToValues(f, obj));
};

