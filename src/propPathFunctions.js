import * as R from 'ramda';
import Maybe from 'folktale/maybe/index.js';
import Result from 'folktale/result/index.js';
import {mapMDeep} from "./monadHelpers.js";

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
            maybe => Maybe.Nothing.hasInstance(maybe),
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
        obj => {
            return R.ifElse(R.isNil, Maybe.Nothing, Maybe.Just)(R.path(path, obj))
        }
    )(obj);
});

/**
 * Sample as strPathOr, but for a list of paths
 * @param {Object} defaultValue. Default value if value is null undefined.
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {Object} The resolved value or the defaultValue
 */
export const pathOr = R.curry((defaultValue, path, props) => {
    const result = R.view(R.lensPath(path), props);
    return R.when(
        R.isNil,
        R.always(defaultValue)
    )(result);
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
 * Like strPath but defaults to the given value
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

/**
 * Like strPath but defaults to the given value if not  truthy, meaning
 * that empty strings also default
 * @param {Object} defaultValue. Default value if falsy
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {function(*=)}
 */
export const strPathTruthyOr = R.curry((defaultValue, str, props) => {
    const result = R.view(R.lensPath(R.split('.', str)), props);
    return R.when(
        R.complement(R.identity),
        R.always(defaultValue)
    )(result);
});

/**
 * strPathOrNullOk for a list of strPaths
 * @param {Object} defaultValue. Default value if value is null undefined.
 * @param {[String]} strPaths dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {[Object]} The mapped values or defaultValue where the value is not truthy
 */
export const strPathsOr = R.curry((defaultValue, strPaths, props) => {
    return R.map(
        _strPath => strPathOr(defaultValue, _strPath, props),
        strPaths
    );
});


/**
 * Like strPathOr but just looks for the full path to lead to a defined value, it doesn't have to be truthy
 * @param {Object} defaultValue. Default value if value is null undefined.
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {function(*=)}
 */
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
 * strPathOrNullOk for a list of strPaths. THe value at each strPath is returned if the path is defined and the
 * value is not undefined
 * @param {Object} defaultValue. Default value if value is null undefined.
 * @param {[String]} strPaths dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {[Object]} The mapped values or defaultValue where the value is only used for undefined values
 */
export const strPathsOrNullOk = R.curry((defaultValue, strPaths, props) => {
    return R.map(
        _strPath => strPathOrNullOk(defaultValue, _strPath, props),
        strPaths
    );
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
 * Whether the dot-separated string path of obj resolves to value or not
 * This no longer uses pathEq because that doesn't work with indices
 * @param {String} strPath Path of props separated by dots
 * @param {*} value The value to check
 * @param {Object|Array} obj The object or array to check
 * @returns {Boolean} True or false
 */
export const strPathEq = R.curry((strPath, value, obj) => {
    return R.equals(
        value,
        R.view(R.lensPath(
                R.map(
                    part => R.when(isNaN, R.always(part))(parseInt(part)),
                    R.split('.', strPath)
                ),
            ), obj
        )
    )
});
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

/**
 * Like eqStrPathsAll but also takes an object that allows overriding the comparison method
 * by strPath
 * @param [{String}] strPaths Paths of props separated by dots, e.g. 'foo.bar.0.woo' where 0 is an index of an array
 * @param {Object} customEqualsObj Keyed by strPaths that need overridden comparison, valued by an equality
 * predicate that takes the same args as eqStrPath: strPath, obj1, obj2
 * @param {Object|Array} obj1 The object to compare to obj2 at the propStr
 * @param {Object|Array} obj2 The object to compare to obj1 at the propStr
 * @returns {Boolean} True or false
 */
export const eqStrPathsAllCustomizable = R.curry(
    (strPaths, customEqualsObj, obj1, obj2) => {
        return R.all(
            stringPath => {
                return strPathOr(
                    // Default
                    eqStrPath,
                    stringPath,
                    customEqualsObj
                )(stringPath, obj1, obj2);
            },
            strPaths
        );
    }
);

/**
 * Maps each item of two sets with the mappingFunc and then compares the two resulting lists as Sets.
 * Useful to quickly compare to lists of objects by id or similar
 * @param {Function} mappingFunc Unary function expecting each item of list1 and list2
 * @param {[Object]} list1 List of items
 * @param {[Object]} list2 List of items
 * @returns {Boolean} True if the mapped items sets equal with R.equals, else false
 */
export const eqAsSetsWith = (mappingFunc, list1, list2) => {
    return R.compose(
        lists => {
            return R.equals(...R.map(l => new Set(l), lists))
        },
        lists => {
            return mapMDeep(2, mappingFunc, lists)
        }
    )([list1, list2])
}