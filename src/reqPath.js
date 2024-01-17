import * as R from "ramda";

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