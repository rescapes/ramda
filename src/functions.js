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
* state is to show an error message, retryTask I/O, etc.
*/

import * as R from 'ramda';
import * as Rm from 'ramda-maybe';
import * as Result from 'folktale/result';

// https://stackoverflow.com/questions/17843691/javascript-regex-to-match-a-regex
const regexToMatchARegex = /\/((?![*+?])(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+)\/((?:g(?:im?|mi?)?|i(?:gm?|mg?)?|m(?:gi?|ig?)?)?)/;

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
  return (
    // If either is a function take the last
    (R.is(Function, l) || R.is(Function, r)) ||
    // If either is an array take the last
    (l && l.concat && Array.isArray(l)) ||
    (r && r.concat && Array.isArray(r))) ||
  !(R.is(Object, l) && R.is(Object, r)) ?
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
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged objeck
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
export const mergeDeepWith = R.curry((fn, left, right) => R.mergeWith((l, r) => {
  // If either (hopefully both) items are arrays or not both objects
  // accept the right value
  return (
    (l && l.concat && Array.isArray(l)) ||
    (r && r.concat && Array.isArray(r))
  ) ||
  !(R.all(R.is(Object)))([l, r]) ||
  R.any(R.is(Function))([l, r]) ?
    fn(l, r) :
    mergeDeepWith(fn, l, r); // tail recursive
})(left, right));

/**
 * Merge Deep that concats arrays of matching keys
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged object
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
export const mergeDeepWithConcatArrays = R.curry((left, right) => mergeDeepWith((l, r) => {
  return R.cond(
    [
      [R.all(R.allPass([R.identity, R.prop('concat'), Array.isArray])), R.apply(R.concat)],
      [R.complement(R.all)(R.is(Object)), R.last],
      [R.T, R.apply(mergeDeepWithConcatArrays)] // tail recursive
    ]
  )([l, r]);
})(left, right));

/**
 * Merge Deep and also apply the given function to array items with the same index
 * @params {Function} fn The merge function left l, right r, string k:: l -> r -> k -> a
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged object
 * @sig mergeDeepWithRecurseArrayItems:: (<k, v>, <k, v>, k) -> <k, v>
 */
export const mergeDeepWithRecurseArrayItems = R.curry((fn, left, right) => R.cond(
  [
    // Arrays
    [R.all(R.allPass([R.identity, R.prop('concat'), Array.isArray])),
      ([l, r]) => {
        return R.zipWith((a, b) => mergeDeepWithRecurseArrayItems(fn, a, b), l, r);
      }
    ],
    // Primitives
    [R.complement(R.all)(R.is(Object)),
      ([l, r]) => {
        return fn(l, r);
      }],
    // Objects
    [R.T, ([l, r]) => {
      return R.mergeWith(mergeDeepWithRecurseArrayItems(fn), l, r);
    }]
  ]
  )([left, right])
);

/**
 * Like mergeDeepWithRecurseArrayItems but merges array items with a function itemMatchBy that determines
 * if an item from each array of left and right represents the same objects. The right object's array
 * items are returned but any left object item matching by itemMatchBy is deep merged with the matching right item.
 * There is no merge function for primitives, r is always returned
 * @params {Function} fn The item matching function, Arrays deep items in left and right
 * are merged. For example
 *   item => R.when(R.is(Object), R.propOr(v, 'id'))(item)
 * would match on id if item is an object and has an id
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to merge
 * @returns {Object} The deep-merged object
 * @sig mergeDeepWithRecurseArrayItems:: (<k, v>, <k, v>, k) -> <k, v>
 */
export const mergeDeepWithRecurseArrayItemsByRight = R.curry((itemMatchBy, left, right) => R.cond(
  [
    // Arrays
    [([l, r]) => {
      return R.all(R.allPass([R.identity, R.prop('concat'), Array.isArray]))([l, r]);
    },
      ([l, r]) => {
        // Create a lookup of l items
        const lItemsByValue = R.indexBy(itemMatchBy, l);
        // Map each item of r
        return R.map(
          rItem => {
            // If the lookup of the r item matches one of l items' itemMatchBy value,
            // recurse with both items. Else just return r
            const rItemValue = itemMatchBy(rItem);
            const hasMatchingLItem = R.has(rItemValue, lItemsByValue);
            return R.when(
              () => hasMatchingLItem,
              () => {
                return mergeDeepWithRecurseArrayItemsByRight(itemMatchBy, R.prop(rItemValue, lItemsByValue), rItem);
              }
            )(rItem);
          }, r
        );
      },
      ([l, r]) => {
        return R.zipWith((a, b) => mergeDeepWithRecurseArrayItemsByRight(itemMatchBy, a, b), l, r);
      }
    ],
    // Primitives
    [R.complement(R.all)(R.is(Object)),
      ([l, r]) => {
        return r;
      }
    ],
    // Objects
    [R.T,
      ([l, r]) => {
        return R.mergeWith(mergeDeepWithRecurseArrayItemsByRight(itemMatchBy), l, r);
      }
    ]
  ]
  )([left, right])
);

/**
 * mergeDeepWithRecurseArrayItems but passes obj as left and right so fn is called on every key
 * @params {Function} fn The merge function left l, right r, string k:: l -> r -> k -> a
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged object
 * @sig mergeDeepWithRecurseArrayItems:: (<k, v>, <k, v>, k) -> <k, v>
 */
export const applyDeep = R.curry((fn, obj) => mergeDeepWithRecurseArrayItems(fn, obj, obj));


/**
 * Merge Deep and also apply the given function to array items with the same index.
 * This adds another function that maps the object results to something else after the objects are recursed upon
 * @params {Function} fn The merge function left l, right r, string k:: l -> r -> k -> a
 * @params {Function} applyObj Function called with the current key and the result of each recursion that is an object.
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged object
 * @sig mergeDeepWithRecurseArrayItems:: (<k, v>, <k, v>, k) -> <k, v>
 */
export const mergeDeepWithRecurseArrayItemsAndMapObjs = R.curry((fn, applyObj, left, right) =>
  _mergeDeepWithRecurseArrayItemsAndMapObjs(fn, applyObj, null, left, right)
);

/**
 * Same as mergeDeepWithRecurseArrayItemsAndMapObjs but sends the same left and right value so fn is called on every key
 * of ob * @params {Function} fn The merge function left l, right r, string k:: l -> r -> k -> a
 * @params {Function} applyObj Function called with the current key and the result of each recursion that is an object.
 * @params {Object} left the 'left' side object to merge
 * @params {Object} right the 'right' side object to morge
 * @returns {Object} The deep-merged object
 * @sig applyDeepAndMapObjs:: (<k, v>, <k, v>, k) -> <k, v>j
 */
export const applyDeepAndMapObjs = R.curry((fn, applyObj, obj) =>
  mergeDeepWithRecurseArrayItemsAndMapObjs(fn, applyObj, obj, obj)
);

const _mergeDeepWithRecurseArrayItemsAndMapObjs = R.curry((fn, applyObj, key, left, right) => {
    return R.cond(
      [
        // Arrays
        [R.all(Array.isArray),
          // Recurse on each array item. We pass the key without the index
          lr => {
            return R.apply(
              R.zipWith(
                (l, r) => R.compose(
                  // For array items, take key and the result and call the applyObj func, but only if res is an Object
                  v => R.when(
                    // When it's an object and not an array call applyObj
                    // typeof x === 'object' check because sometimes values that are objects are not returning true
                    R.both(
                      vv => typeof vv === 'object',
                      R.complement(R.is)(Array)
                    ),
                    res => applyObj(key, res)
                  )(v),
                  ([kk, ll, rr]) => _mergeDeepWithRecurseArrayItemsAndMapObjs(fn, applyObj, kk, ll, rr)
                )([key, l, r])
              )
            )(lr);
          }
        ],
        // Primitives: call the function with left and right as the first two args and key as the last
        [R.complement(R.all)(R.is(Object)), lr => {
          return fn(...lr, key);
        }],
        // Always leave functions alone.
        [lr => R.all(R.is(Function), lr), ([l, _]) => {
          return l;
        }],
        // Objects
        [R.T,
          lr => {
            return R.apply(
              R.mergeWithKey(
                (k, l, r) => R.compose(
                  // Take key and the result and call the applyObj func, but only if res is an Object
                  v => R.when(
                    // When it's an object and not an array call applyObj
                    // typeof x === 'object' check because sometimes values that are objects are not returning true
                    R.both(
                      x => typeof x === 'object',
                      R.complement(R.is)(Array)
                    ),
                    res => applyObj(k, res)
                  )(v),
                  // First recurse on l and r
                  ([kk, ll, rr]) => R.apply(_mergeDeepWithRecurseArrayItemsAndMapObjs(fn, applyObj), [kk, ll, rr])
                )([k, l, r])
              ),
              lr
            );
          }
        ]
      ]
    )([left, right]);
  }
);


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
  R.toLower(str).replace(
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
 * @param {Object} defaultValue. Default value if value is null undefined.
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {function(*=)}
 */
export const strPathOr = R.curry((defaultValue, str, props) => {
  const result = R.view(R.lensPath(R.split('.', str)), props);
  return R.when(
    R.isNil,
    R.always(defaultValue)
  )(result);
});

export const strPathOrNullOk = R.curry((defaultValue, str, props) => {
  const segments = R.split('.', str);
  const result = R.view(R.lensPath(R.init(segments)), props);
  return R.ifElse(
    R.isNil,
    R.always(defaultValue),
    r => {
      try {
        return R.when(v => typeof v === 'undefined', () => defaultValue)(R.prop(R.last(segments), r));
      } catch {
        return defaultValue;
      }
    }
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
export const mapKeys = R.curry(
  (fn, obj) => R.compose(
    R.fromPairs,
    pairs => R.map(
      // Apply fn to index 0 of pair
      pair => R.adjust(0, fn, pair),
      pairs
    ),
    R.toPairs
  )(obj)
);


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
 * Maps an object with a function that returns pairs and create and object therefrom
 * Like R.mapObjIndexed, the function's first argument is the value of each item, and the seconds is the key if
 * iterating over objects
 * @params {Functor} f The mapping function
 * @params {Container} container Anything that can be mapped
 * @returns {Object} The mapped pairs made into key values
 * @sig mapKeysAndValues :: Functor F = (a -> [b,c]) -> F -> <k,v>
 */
export const mapKeysAndValues = R.curry((f, container) => R.fromPairs(mapObjToValues(f, container)));

/**
 * https://github.com/ramda/ramda/wiki/Cookbook
 * Filter objects with values and keys. Null objs return as null
 * @param {Function} pred (value, key) => True|False
 * @param {Object} obj The object to filter
 * @returns {Object} The filtered object
 * @sig filterWithKeys:: (v -> k -> True|False) -> <k,v> -> <k,v>
 */
export const filterWithKeys = R.curry((pred, obj) => {
  if (!obj) {
    return obj;
  }
  return R.compose(
    R.fromPairs,
    R.filter(pair => R.apply(pred, R.reverse(pair))),
    R.toPairs
  )(obj);
});

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
 * @param {Function} lens A ramda lens that points to the object containing the key, not the key itself.
 * Use R.lensPath([]) to operate directly on obj
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
 * Duplicates the key of the object specified by the lens and key, to the given list of keys or single key.
 * A duplicate of the value at key will be added at each of the toKeys using R.clone
 * @param {Function} lens A ramda lens that points to the object containing the key, not the key itself
 * @param {String} key Key to duplicate the value of
 * @param {String|[String]} toKeys Array of new keys to make. New keys overwrite existing keys
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
        toArrayIfNot(toKeys)
      )
    )
  ),
  // take the lens of this obj
  obj)
);

/**
 * Converts a scalar value (!Array.isArray) to array an array
 * @param {*|[*]} arrayOrScalar An array or scalar
 * @returns {[*]} The scalar as an array or the untouched array
 */
export const toArrayIfNot = arrayOrScalar => {
  return R.unless(Array.isArray, Array.of)(arrayOrScalar);
};

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
 * Returns the items matching all param key values
 * @param {Object} params Key values to match to items
 * @param {Object|Array} items Object with values of objects or array of objects that can produce values to search
 * @returns {[Object]} items that pass
 */
export const findByParams = (params, items) => {
  return R.filter(
    // Compare all the eqProps against each item
    R.allPass(
      // Create a eqProps for each prop of params
      R.map(prop => R.eqProps(prop, params),
        R.keys(params)
      )
    ),
    items
  );
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
export const mapObjToValues = R.curry((f, obj) => {
  return R.values(R.mapObjIndexed(f, obj));
});

/**
 * Filter the given object and return the values, discarding the keys
 * @param {Function} f Receives each value and key
 * @param {Object} obj The object to filter
 * @return {Object} The filtered object values
 */
export const filterObjToValues = R.curry((f, obj) => {
  return R.values(filterWithKeys(f, obj));
});
/**
 * Like mapObjToValues but chains the values when an array is returned for each mapping
 * @param {Function} f Expects key, value, and obj
 * @param {Object} obj The object to chain
 * @return {[Object]} Mapped flattened values
 */
export const chainObjToValues = R.curry((f, obj) => {
  return R.chain(R.identity, mapObjToValues(f, obj));
});


/**
 *
 * This is a deep fromPairs. If it encounters a two element array it assumes it's a pair if the first
 * element is a string. If an array is not a pair it is iterated over and each element is recursed upon.
 * The 2nd element of each pair is also recursed upon. The end case for recursion is that an element is not an array.
 *
 * This method doesn't currently expect objects but could be easily modified to handle them
 * @param {[*]} deepPairs An array of deep pairs, with possibly other arrays at the top or lower levels
 * that aren't pairs but might contain them
 * @returns {Array|Object} All arrays of pairs are converted to objects. Arrays of non pairs are left as arrays
 */
export const fromPairsDeep = deepPairs => R.cond(
  [
    // It's array of pairs or some other array
    [Array.isArray, list =>
      R.ifElse(
        // Is the first item a two element array whose first item is a string?
        ([first]) => R.allPass(
          [
            Array.isArray,
            x => R.compose(R.equals(2), R.length)(x),
            x => R.compose(R.is(String), R.head)(x)
          ])(first),
        // Yes, return an object whose keys are the first element and values are the result of recursing on the second
        l => R.compose(R.fromPairs, R.map(([k, v]) => [k, fromPairsDeep(v)]))(l),
        // No, recurse on each array item
        l => R.map(v => fromPairsDeep(v), l)
      )(list)
    ],
    // End case, return the given value unadulterated
    [R.T, R.identity]
  ])(deepPairs);


/**
 * At the given depth, object and array values are converted to the replacementString.
 * @param {Number} n Depth to replace at.
 * Depth 3 converts {a: {b: {c: 1}}} to {a: {b: {c: '...'}}}
 * Depth 2 converts {a: {b: {c: 1}}} to {a: {b: '...'}}
 * Depth 1 converts {a: {b: {c: 1}}} to {a: '...'}
 * Depth 0 converts {a: {b: {c: 1}}} to '...'
 * @param {String|Function} replaceStringOrFunc String such as '...' or a unary function that replaces the value
 * e.g. R.when(R.is(Object), R.length(R.keys)) will count objects and arrays but leave primitives alone
 * @param {Object} obj Object to process
 * @returns {Object} with the above transformation. Use replaceValuesAtDepthAndStringify to get a string
 */
export function replaceValuesAtDepth(n, replaceStringOrFunc, obj) {
  return R.ifElse(
    // If we are above level 0 and we have an object
    R.both(R.always(R.lt(0, n)), R.is(Object)),
    // Then recurse on each object or array value
    o => R.map(oo => replaceValuesAtDepth(n - 1, replaceStringOrFunc, oo), o),
    // If at level 0 replace the value. If not an object or not at level 0, leave it alone
    o => R.when(R.always(R.equals(0, n)), alwaysFunc(replaceStringOrFunc))(o)
  )(obj);
}

/** *
 * replaceValuesAtDepth but stringifies result
 * @param {Number} n Depth to replace at.
 * Depth 3 converts {a: {b: {c: 1}}} to {a: {b: {c: '...'}}}
 * Depth 2 converts {a: {b: {c: 1}}} to {a: {b: '...'}}
 * Depth 1 converts {a: {b: {c: 1}}} to {a: '...'}
 * Depth 0 converts {a: {b: {c: 1}}} to '...'
 * @param {String|Function} replaceString String such as '...' or a unary function that replaces the value
 * e.g. R.when(R.is(Object), R.length(R.keys)) will count objects and arrays but leave primitives alone
 * @param {Object} obj Object to process
 * @returns {String} after the above replacement
 */
export const replaceValuesAtDepthAndStringify = (n, replaceString, obj) => {
  return JSON.stringify(replaceValuesAtDepth(n, replaceString, obj));
};

/**
 * Convenient method to count objects and lists at the given depth but leave primitives alone
 * @param {Number} n Depth to replace at.
 * @param {Object} obj Object to process
 * @returns {Object} after the above replacement
 */
export const replaceValuesWithCountAtDepth = (n, obj) => {
  return replaceValuesAtDepth(
    n,
    R.when(
      R.is(Object),
      o => R.compose(
        // Show arrays and objs different
        R.ifElse(R.always(Array.isArray(o)), c => `[...${c}]`, c => `{...${c}}`),
        R.length,
        R.keys)(o)
    ),
    obj);
};

/**
 * Convenient method to count objects and lists at the given depth but leave primitives alone and stringify result
 * @param {Number} n Depth to replace at.
 * @param {Object} obj Object to process
 * @returns {String} after the above replacement
 */
export const replaceValuesWithCountAtDepthAndStringify = (n, obj) => {
  return JSON.stringify(replaceValuesWithCountAtDepth(n, obj));
};

/**
 * Flattens an objects so deep keys and array indices become concatinated strings
 * E.g. {a: {b: [1, 3]}} => {'a.b.0': 1, 'a.b.1': 2}
 * @param {Object} obj The object to flattened
 * @returns {Object} The 1-D version of the object
 */
export const flattenObj = obj => {
  return R.fromPairs(_flattenObj({}, obj));
};

/**
 * Flatten objs until the predicate returns false. This is called recursively on each object and array
 * @param {Function} predicate Expects object, returns true when we should stop flatting on the current object
 * @param {Object} obj The object to flatten
 * @return {Object} The flattened object
 */
export const flattenObjUntil = (predicate, obj) => {
  return R.fromPairs(_flattenObj({predicate}, obj));
};

const _flattenObj = (config, obj, keys = []) => {
  const predicate = R.propOr(null, 'predicate', config);
  return R.ifElse(
    // If we have an object
    o => R.both(
      R.is(Object),
      oo => R.when(
        () => predicate,
        ooo => R.complement(predicate)(ooo)
      )(oo)
    )(o),
    // Then recurse on each object or array value
    o => chainObjToValues((oo, k) => _flattenObj(config, oo, R.concat(keys, [k])), o),
    // If not an object return flat pair
    o => [[R.join('.', keys), o]]
  )(obj);
};

/**
 * Converts a key string like 'foo.bar.0.wopper' to ['foo', 'bar', 0, 'wopper']
 * @param {String} keyString The dot-separated key string
 * @returns {[String]} The lens array containing string or integers
 */
export const keyStringToLensPath = keyString => R.map(
  R.when(R.compose(R.complement(R.equals)(NaN), parseInt), parseInt),
  R.split('.', keyString)
);

/**
 * Undoes the work of flattenObj. Does not allow number keys to become array indices
 * @param {Object} obj 1-D object in the form returned by flattenObj
 * @returns {Object} The original
 */
export const unflattenObjNoArrays = obj => {
  return _unflattenObj({allowArrays: false}, obj);
};

/**
 * Undoes the work of flattenObj
 * @param {Object} obj 1-D object in the form returned by flattenObj
 * @returns {Object} The original
 */
export const unflattenObj = obj => {
  return _unflattenObj({allowArrays: true}, obj);
};

export const _unflattenObj = (config, obj) => {
  return R.compose(
    R.reduce(
      (accum, [keyString, value]) => {
        // Don't allow indices if allowArrays is false
        const itemKeyPath = R.map(
          key => {
            return R.when(
              () => R.not(R.prop('allowArrays', config)),
              k => k.toString()
            )(key);
          },
          keyStringToLensPath(keyString)
        );
        // Current item lens
        const itemLensPath = R.lensPath(itemKeyPath);
        // All but the last segment gives us the item container len
        const constainerKeyPath = R.init(itemKeyPath);
        const container = R.unless(
          // If the path has any length (not []) and the value is set, don't do anything
          R.both(R.always(R.length(constainerKeyPath)), R.view(R.lensPath(constainerKeyPath))),
          // Else we are at the top level, so use the existing accum or create a [] or {}
          // depending on if our item key is a number or not
          x => R.defaultTo(
            R.ifElse(
              v => R.both(() => R.prop('allowArrays', config), R.is(Number))(v),
              R.always([]),
              R.always({})
            )(R.head(itemKeyPath))
          )(x)
        )(accum);
        // Finally set the container at the itemLensPath
        return R.set(
          itemLensPath,
          value,
          container
        );
      },
      // null initial value
      null
    ),
    R.toPairs
  )(obj);
};

/**
 * Does something to every object
 * @param {Function} func Called on each object that is the child of another object. Called with the key that
 * points at it from the parent object and the object itself
 * @param {Object} obj The object to process
 */
export const overDeep = R.curry((func, obj) => mergeDeepWithRecurseArrayItemsAndMapObjs(
  // We are using a mergeDeepWithRecurseArrayItemsAndMapObjs but we only need the second function
  (l, r, k) => l,
  func,
  // Use obj twice so that all keys match and get called with the merge function
  obj,
  obj
  )
);

/**
 * Omit the given keys anywhere in a data structure. Objects and arrays are recursed and omit_deep is called
 * on each dictionary that hasn't been removed by omit_deep at a higher level
 */
export const omitDeep = R.curry(
  (omit_keys, obj) => R.compose(
    o => applyDeepAndMapObjs(
      // If k is in omit_keys return {} to force the applyObj function to call. Otherwise take l since l and r are always the same
      (l, r, kk) => R.ifElse(
        k => R.contains(k, omit_keys),
        R.always({}),
        R.always(l)
      )(kk),
      // Called as the result of each recursion. Removes the keys at any level except the topmost level
      (key, result) => R.omit(omit_keys, result),
      o
    ),
    // Omit at the top level. We have to do this because applyObj of applyDeepAndMapObjs only gets called starting
    // on the object of each key
    o => R.omit(omit_keys, o)
  )(obj)
);

/**
 * Omit by the given function that is called with key and value. You can ignore the value if you only want to test the key
 * Objects and arrays are recursed and omit_deep is called
 * on each dictionary that hasn't been removed by omit_deep at a higher level
 * @param {Function} f Binary function accepting each key, value. Return non-nil to omit and false or nil to keep
 */
export const omitDeepBy = R.curry(
  (f, obj) => R.compose(
    o => applyDeepAndMapObjs(
      // If k is in omit_keys return {} to force the applyObj function to call. Otherwise take l since l and r are always the same
      // l and r are always the same value
      (l, r, kk) => R.ifElse(
        // Reject any function return value that isn't null or false
        k => R.anyPass([R.isNil, R.equals(false)])(f(k, l)),
        R.always(l),
        R.always({})
      )(kk),
      // Called as the result of each recursion. Removes the keys at any level except the topmost level
      (key, result) => filterWithKeys(
        (v, k) => R.anyPass([R.isNil, R.equals(false)])(f(k, v)),
        result
      ),
      o
    ),
    // Omit at the top level. We have to do this because applyObj of applyDeepAndMapObjs only gets called starting
    // on the object of each key
    // Reject any function return value that isn't null or false
    o => filterWithKeys(
      (v, k) => R.anyPass([R.isNil, R.equals(false)])(f(k, v)),
      o
    )
  )(obj)
);

/**
 * Given a predicate for eliminating an item based on paths, return the paths of item that don't pass the predicate.
 * keyOrIndex is the object key or array index that the item came from. We use it for the eliminateItemPredicate
 * test. If each paths current first segment matches keyOrIndex or equals '*', we consider that path.
 * With the considered paths
 * @param {Function} eliminateItemPredicate Accepts the remaining paths and optional item as a second argument.
 * Returns true if the item shall be eliminated
 * @param {[String]} paths Paths to caculate if they match the item
 * @param {*} item Item to test
 * @param {String|Number} keyOrIndex The key or index that the item belonged to of an object or array
 * @return {Object} {item: the item, paths: remaining paths with first segment removed}. Or null if eliminateItemPredicate
 * returns true
 * @private
 */
const _calculateRemainingPaths = (eliminateItemPredicate, paths, item, keyOrIndex) => {
  // Keep paths that match keyOrIndex as the first item. Remove other paths
  // since they can't match item or its descendants
  const tailPathsStillMatchingItemPath = compact(R.map(
    R.compose(
      R.ifElse(
        R.compose(
          aKeyOrIndex => {
            return R.ifElse(
              // if keyOrIndex is a string and matches the shape of a regex: /.../[gim]
              possibleRegex => R.both(R.is(String), str => R.test(regexToMatchARegex, str))(possibleRegex),
              // Construct the regex with one or two, the expression and options (gim)
              provenRegex => {
                const args = compactEmpty(R.split('/', provenRegex));
                return new RegExp(...args).test(keyOrIndex);
              },
              // If aKeyOrIndex is '*' or equals keyOrIndex always return true
              str => R.includes(str, ['*', keyOrIndex])
            )(aKeyOrIndex);
          },
          R.head
        ),
        // Matches the keyOrIndex at the head. Return the tail
        R.tail,
        // Mark null to remove from list
        R.always(null)),
      // Convert path to array with string keys and number indexes
      keyStringToLensPath
    ),
    paths
  ));
  // For omit:
  // If any path matches the path to the item return null so we can throw away the item
  // If no path is down to zero length return the item and the paths
  // For pick:
  // If no path matches the path to the item return null so we can throw away the item
  // If any path is not down to zero return the item and the paths, unless item is a primitive meaning it can't match
  // a path
  return R.ifElse(
    tailPaths => eliminateItemPredicate(tailPaths, item),
    R.always(null),
    p => ({item: item, paths: R.map(R.join('.'), p)})
  )(tailPathsStillMatchingItemPath);
};

// This predicate looks for any path that's zero length, meaning it matches the path to an item and we should
// omit that item
const _omitDeepPathsEliminateItemPredicate = paths => R.any(R.compose(R.equals(0), R.length), paths);

/**
 * Omit matching paths in a a structure. For instance omitDeepPaths(['a.b.c', 'a.0.1']) will omit keys
 * c in {a: {b: c: ...}}} and 'y' in {a: [['x', 'y']]}
 */
export const omitDeepPaths = R.curry((pathSet, obj) => R.cond([

    // Arrays
    [o => Array.isArray(o),
      list => {
        // Recurse on each array item that doesn't match the paths.
        // We pass the key without the index
        // If any path matches the path to the value we return the item and the matching paths
        const survivingItems = compact(R.addIndex(R.map)(
          (item, index) => _calculateRemainingPaths(_omitDeepPathsEliminateItemPredicate, pathSet, item, index),
          list
        ));
        return R.map(({paths, item}) => omitDeepPaths(paths, item), survivingItems);
      }
    ],
    // Primitives always pass.
    [R.complement(R.is(Object)), primitive => primitive],
    // Objects
    [R.T,
      o => {
        // Recurse on each object value that doesn't match the paths.
        const survivingItems = compact(R.mapObjIndexed(
          // If any path matches the path to the value we return the value and the matching paths
          // If no path matches it we know the value shouldn't be omitted so we don't recurse on it below
          (value, key) => _calculateRemainingPaths(_omitDeepPathsEliminateItemPredicate, pathSet, value, key),
          o
        ));
        // Only recurse on items from the object that are still eligible for omitting
        return R.map(({paths, item}) => omitDeepPaths(paths, item), survivingItems);
      }
    ]
  ]
  )(obj)
);

// This eliminate predicate returns true if no path is left matching the item's path so the item should not
// be picked. It also returns true if the there are paths with length greater than 0
// but item is a primitive, meaning it can't match a path
const _pickDeepPathsEliminateItemPredicate = (paths, item) => {
  return R.either(
    R.compose(R.equals(0), R.length),
    pths => {
      return R.both(
        // Item is not an object
        () => R.complement(R.is)(Object, item),
        ps => R.any(R.compose(R.lt(0), R.length), ps)
      )(pths);
    }
  )(paths);
};
/**
 * Pick matching paths in a a structure. For instance pickDeepPaths(['a.b.c', 'a.0.1']) will pick only keys
 * c in {a: {b: c: ...}}} and 'y' in {a: [['x', 'y']]}.
 * Use * in the path to capture all array items or keys, e.g. ['a.*.c./1|3/']
 * to get all items 0 or 3 of c that is in all items of a, whether a is an object or array
 */
export const pickDeepPaths = R.curry((pathSet, obj) => R.cond([
    // Arrays
    [o => Array.isArray(o),
      list => {
        // Recurse on each array item that doesn't match the paths. We pass the key without the index
        // We pass the key without the index
        // If any path matches the path to the value we return the item and the matching paths
        const survivingItemsEachWithRemainingPaths = compact(R.addIndex(R.map)(
          (item, index) => {
            return _calculateRemainingPaths(_pickDeepPathsEliminateItemPredicate, pathSet, item, index);
          },
          list
        ));
        return R.map(
          R.ifElse(
            // If the only paths are now empty we have a match with the items path and keep the item.
            // Otherwise we pick recursively
            ({paths}) => R.all(R.compose(R.equals(0), R.length), paths),
            ({item}) => item,
            ({item, paths}) => pickDeepPaths(paths, item)
          ),
          survivingItemsEachWithRemainingPaths
        );
      }
    ],
    // Primitives never match because we'd only get here if we have pathSets remaining and no path can match a primitive
    [R.complement(R.is(Object)),
      () => {
        throw new Error('pickDeepPaths encountered a value that is not an object or array at the top level. This should never happens and suggests a bug in this function');
      }
    ],
    // Objects
    [R.T,
      o => {
        // Recurse on each array item that doesn't match the paths. We pass the key without the index
        // If any path matches the path to the value we return the value and the matching paths
        // If no path matches it we know the value shouldn't be picked so we don't recurse on it below
        const survivingItems = compact(R.mapObjIndexed(
          (item, key) => _calculateRemainingPaths(_pickDeepPathsEliminateItemPredicate, pathSet, item, key),
          o
        ));
        return R.map(
          R.ifElse(
            // If the only path is now empty we have a match with the items path and keep the item.
            // Otherwise we pick recursively
            ({item, paths}) => R.all(R.compose(R.equals(0), R.length), paths),
            R.prop('item'),
            ({item, paths}) => pickDeepPaths(paths, item)
          ),
          survivingItems
        );
      }
    ]
  ]
  )(obj)
);

/**
 * splitAt that gives the split point item to both sides of the split
 * @param {Number} index The index
 * @param {String|[Object]} list A string or list
 * @returns {[Object]} A pair of results
 */
export const splitAtInclusive = (index, list) => {
  const pair = R.splitAt(index, list);
  return [
    R.concat(R.head(pair), R.slice(0, 1, R.last(pair))),
    R.last(pair)
  ];
};

/**
 * Whether the objects are equal at the given propStr. Null objects are never equal
 * @param {String} stringPath Path of props separated by dots
 * @param {Object|Array} obj1 The object to compare to obj2 at the propStr
 * @param {Object|Array} obj2 The object to compare to obj1 at the propStr
 * @returns {Boolean} True or false
 */
export const eqStrPath = R.curry((stringPath, obj1, obj2) => {
  return R.apply(R.equals, R.map(strPathOr(null, stringPath), [obj1, obj2]));
});

/**
 * Whether the objects are equal at the given strPaths. Null objects are never equal
 * @param [{String}] strPaths Paths of props separated by dots
 * @param {Object|Array} obj1 The object to compare to obj2 at the propStr
 * @param {Object|Array} obj2 The object to compare to obj1 at the propStr
 * @returns {Boolean} True or false
 */
export const eqStrPathsAll = R.curry(
  (strPaths, obj1, obj2) => R.all(prop => eqStrPath(prop, obj1, obj2), strPaths)
);
