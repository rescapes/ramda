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
 * Utility functions, which rely heavily on Ramda, data.task, and Ramda Fantasy types
 * These functions should all be pure. Equivalent throwing functions can
 * be found in throwingFunctions. throwingFunctions should only be used for coding errors,
 * such as improper function arguments or an invalid path within object.
 * I/O Errors should be handled using Maybe or Either and calling functions should expect them.
 * An I/O Error should always result in a valid state of an application, even if that valid
 * state is to show an error message, retry I/O, etc.
 */

const R = require('ramda');
const Rm = require('ramda-maybe');
const Task = require('data.task');
const {Maybe, Either} = require('ramda-fantasy');

/**
 * Return an empty string if the given entity is falsy
 * @param {Object} entity The entity to check
 * @returns {String|Object} The empty string or the Object
 * @sig orEmpty:: a -> a
 *        :: a -> String
 */
const orEmpty = module.exports.orEmpty = entity => entity || '';

/**
 * Removed null or undefined items from an iterable
 * @param [a] items Items that might have falsy values to remove
 * @returns The compacted items
 * @sig compact:: [a] -> [a]
 * @sig compact:: {k,v} -> {k,v}
 */
const compact = module.exports.compact = R.reject(R.isNil);

/**
 * Remove empty strings
 * @param [a] items Items that might have empty or null strings to remove
 * @returns The compacted items
 * @sig compactEmpty:: [a] -> [a]
 */
const compactEmpty = module.exports.compactEmpty = R.reject(R.either(R.isNil, R.isEmpty));

/**
 * Convert an empty value to null
 * @param a item Item that might be empty according to isEmpty
 * @returns the
 * @sig emptyToNull:: a -> a
 *            :: a -> null
 */
const emptyToNull = module.exports.emptyToNull = R.when(R.isEmpty, ()=>null);

/**
 * Join elements, first remove null items and empty strings. If the result is empty make it null
 * @param connector Join connector string
 * @param [a] items Items to join that might be removed
 * @sig compactEmpty:: [a] -> String
 *             :: [a] -> null
 */
const compactJoin = module.exports.compactJoin = R.compose(
    (connector, items) => R.pipe(compactEmpty, R.join(connector), emptyToNull)(items)
);

/**
 * Creates a partial mapping function that expects an iterable and maps each item of the iterable to the given property
 * @param {String} prop The prop of each object to map
 * @param {[Object]} items The objects to map
 * @returns {[Object]} The mapped objects
 * @sig mapProp :: String -> [{k, v}] -> [a]
 */
const mapProp = module.exports.mapProp = R.curry((prop, objs) => R.pipe(R.prop, R.map)(prop)(objs));

/**
 * Creates a partial function that maps an array of objects to an object keyed by the given prop of the object's
 * of the array, valued by the item. If the item is not an array, it leaves it alone, assuming it is already indexed
 * @param {String} prop The prop of each object to use as the key
 * @param {[Object]} items The items to map
 * @returns {Object} The returned object
 * @sig mapPropValueAsIndex:: String -> [{k, v}] -> {j, {k, v}}
 * @sig mapPropValueAsIndex:: String -> {k, v} -> {k, v}
 */
const mapPropValueAsIndex = module.exports.mapPropValueAsIndex = R.curry((prop, obj) =>
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
const removeDuplicateObjectsByProp = module.exports.removeDuplicateObjectsByProp = R.curry((prop, list) =>
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
const idOrIdFromObj = module.exports.idOrIdFromObj = R.when(
    objOrId => (typeof objOrId === 'object') && objOrId !== null,
    R.prop('id')
);

/**
 * Reduces with the current and next value of a list. The reducer is called n-1 times for a list of n length
 * @param {callWithNext} fn The reducer
 * @param {Object} head The first item of the list
 * @param {Object} previous The initial reduction value
 * @param {Object} next The next item
 * @param {Object} tail The remaining items
 * @returns {Object} the reduction
 */
const reduceWithNext = module.exports.reduceWithNext = (fn, [head, next, ...tail], previous) =>
    typeof (next) === 'undefined' ?
        previous :
        reduceWithNext(fn, [next, ...tail], fn(previous, head, next));

/**
 * @callback callWithNext
 * @param {Object} total the reduction
 * @param {Object} current the current item
 * @param {Object} next the next item
 * @returns {Object} the next reduction
 */

/**
 * Deep merge values that are objects but not arrays
 * based on https://github.com/ramda/ramda/pull/1088
 * @params {Object} l the 'left' side object to merge
 * @params {Object} r the 'right' side object to merge
 * @type {Immutable.Map<string, V>|__Cursor.Cursor|List<T>|Map<K, V>|*}
 * @returns {Object} The deep-merged object
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
const mergeDeep = module.exports.mergeDeep = R.mergeWith((l, r) => {
    // If either (hopefully both) items are arrays or not both objects
    // accept the right value
    return ((l && l.concat) || (r && r.concat)) || !(R.is(Object, l) && R.is(Object, r)) ?
        r :
        mergeDeep(l, r); // tail recursive
});

/**
 * Deep merge values with a custom function that are objects or arrays
 * based on https://github.com/ramda/ramda/pull/1088
 * @params {Function} fn The merge function Left l, Right r:: l -> r -> a
 * @params {Object} l the 'left' side object to merge
 * @params {Object} r the 'right' side object to merge
 * @type {Immutable.Map<string, V>|__Cursor.Cursor|List<T>|Map<K, V>|*}
 * @returns {Object} The deep-merged object
 * @sig mergeDeep:: (<k, v>, <k, v>) -> <k, v>
 */
const mergeDeepWith = module.exports.mergeDeepWith = R.curry((fn, left, right) => R.mergeWith((l, r) => {
    // If both objects are arrays or both objects run the merge function
    // Otherwise return r, assuming no l exists
    return ((l && l.concat) && (r && r.concat)) || (R.is(Object, l) && R.is(Object, r)) ?
        mergeDeep(l, r) : // tail recursive
        r;
}));

/**
 * http://stackoverflow.com/questions/40011725/point-free-style-capitalize-function-with-ramda
 * Capitalize the first letter
 * @param {String} str The string to capitalize
 * @returns {String} The capitalized string
 * @sig capitalize:: String -> String
 */
const capitalize = module.exports.capitalize = str => R.compose(
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
const lowercase = module.exports.lowercase = str => R.compose(
    R.join(''),
    R.juxt([R.compose(R.toLower, R.head), R.tail])
)(str);

/**
 * From https://github.com/substack/camelize/blob/master/index.js
 * @param {String} str The string to camelCase
 * @returns {String} The camel-cased string
 */
const camelCase = module.exports.camelCase = str =>
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
const mergeAllWithKey = module.exports.mergeAllWithKey = R.curry((fn, [head, ...rest]) =>
    R.mergeWithKey( // call mergeWithKey on two objects at a time
        fn,
        head || {}, // first object is always the head
        R.ifElse( // second object is the merged object of the recursion
            R.isEmpty, // if no rest
            () => R.empty({}), // end case empty object
            mergeAllWithKey(fn), // else recurse with the rest
        )(rest)
    )
);

/**
 * Get a required path or return a helpful Error if it fails
 * @param {String} path A lensPath, e.g. ['a', 'b'] or ['a', 2, 'b']
 * @param {Object} obj The object to inspect
 * @returns {Either} Either the resolved value or an Error
 * @sig reqPath:: String -> {k: v} → Either
 */
const reqPath = module.exports.reqPath = R.curry((path, obj) => {
  return R.compose(
    R.ifElse(
        // If path doesn't resolve
        Maybe.isNothing,
        // Create a useful Error message
        () => Either.Left({
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
        res => Either.Right(res.value)
    ),
    // Try to resolve the value using the path and obj, returning Maybe
    Rm.path(path))(obj);
});

/**
 * Uses reqPath to resolve the path of an object and compares it to val
 * @param {String} path A lensPath, e.g. ['a', 'b'] or ['a', 2, 'b']
 * @param {*} val The val to do an equality check on
 * @param {Object} obj The object to inspect
 * @returns {Either} Either the resolved value or an Error
 * @sig reqPath:: String -> {k: v} → Either
 */
const reqPathPropEq = module.exports.reqPathPropEq = R.curry((path, val, obj) =>
  // If the reqPath is valid map it to a comparison with val
  reqPath(path, obj).map(R.equals(val))
);

/**
 * Wraps a Task in a Promise.
 * @param {Task} task The Task
 * @param {boolean} expectReject Set true for testing when a rejection is expected
 * @returns {Promise} The Task as a Promise
 */
const taskToPromise = module.exports.taskToPromise = (task, expectReject = false) => {
    if (!task.fork) {
        throw new TypeError(`Expected a Task, got ${typeof task}`);
    }
    return new Promise((res, rej) =>
        task.fork(
            reject => {
                if (!expectReject) {
                    // console.log('Unhandled Promise', prettyFormat(reject));
                    if (reject && reject.stack) {
                        // console.log(stackTrace.parse(reject));
                    }
                }
                return rej(reject);
            },
            resolve => res(resolve)
        )
    );
};

/**
 * Wraps a Promise in a Task
 * @param {Promise} promise The promise
 * @param {boolean} expectReject default false. Set true for testing to avoid logging rejects
 * @returns {Task} The promise as a Task
 */
const promiseToTask = module.exports.promiseToTask = (promise, expectReject = false) => {
    if (!promise.then) {
        throw new TypeError(`Expected a Promise, got ${typeof promise}`);
    }
    return new Task((rej, res) => promise.then(res).catch(reject => {
        /*
        if (!expectReject) {
            console.warn('Unhandled Promise', prettyFormat(reject));
            console.warn(reject.stack);
        }
        */
        return rej(reject);
    }));
};

/**
 * From the cookbook: https://github.com/ramda/ramda/wiki/Cookbook#map-keys-of-an-object
 * Maps keys according to the given function
 * @returns {Object} The mapped keys of the object
 * @sig mapKeys :: (String -> String) -> Object -> Object
*/
const mapKeys = module.exports.mapKeys = R.curry((fn, obj) =>
    R.fromPairs(R.map(R.adjust(fn, 0), R.toPairs(obj))));


/**
 * Uses a lens to map keys that are embedded in a data structure
 * The lens must indicate an object whose keys shall be mapped
 * @returns {Object} Object with the keys indicated by the given lens mapped
 * @sig mapKeysForLens :: Lens -> ((String -> String) -> Object -> Object
 */
const mapKeysForLens = module.exports.mapKeysForLens = R.curry((lens, fn, obj) =>
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
const mapDefault = module.exports.mapDefault = (keyName, module) => mapKeys(key => key === 'default' ? keyName : key, module);
/**
 * Converts default to desired name and prefixes others.
 * Used for requiring defaults and renaming others
 * @param {String} defaultName The desired rename of 'default'
 * @param {String} prefix The desired prefix for others. Camel Case maintained
 * @param {Object} module A required module with a default key
 * @returns {Object} The import module with key default changed to keyName
 * @sig mapDefault :: String -> <k,v> -> <k,v>
 */
const mapDefaultAndPrefixOthers = module.exports.mapDefaultAndPrefixOthers = (defaultName, prefix, module) =>
    mapKeys(
        key => (key === 'default') ? defaultName : `${prefix}${capitalize(key)}`,
        module
    );

/**
 * Maps a functor with a function that returns pairs and create and object therefrom
 * Like R.mapObjIndexed, the function's first argument is the value of each item, and the seconds is the key if
 * iterating over objects
 * @params {Function} f The mapping function
 * @params {Functor} functor Anything that can be mapped
 * @returns {Object} The mapped pairs made into key values
 * @sig fromPairsMap :: Functor F = (a -> [b,c]) -> F -> <k,v>
 */
const fromPairsMap = module.exports.fromPairsMap = R.curry((f, functor) => R.fromPairs(R.mapObjIndexed(f, functor)));

/**
 * https://github.com/ramda/ramda/wiki/Cookbook
 * Filter objects with values and keys
 * @param {Function} pred (value, key) => True|False
 * @param {Object} obj The object to filter
 * @returns {Object} The filtered object
 * @sig filterWithKeys:: (v -> k -> True|False) -> <k,v> -> <k,v>
 */
const filterWithKeys = module.exports.filterWithKeys = R.curry((pred, obj) => R.pipe(
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
const transformKeys = module.exports.transformKeys = R.curry((func, obj) =>
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
module.exports.renameKey = R.curry((lens, from, to, obj) => R.over(
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
module.exports.duplicateKey = R.curry((lens, key, toKeys, obj) => R.over(
  lens,
  target => R.merge(target, R.fromPairs(R.map(toKey => [toKey, R.clone(target[key])], toKeys))),
  obj)
);
