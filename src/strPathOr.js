import * as R from "ramda";

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