import * as R from "ramda";

/**
 * Converts a key string like 'foo.bar.0.wopper' to ['foo', 'bar', 0, 'wopper']
 * @param {String} keyString The dot-separated key string
 * @returns {[String]} The lens array containing string or integers
 */
export const keyStringToLensPath = keyString => R.map(
    R.when(R.compose(R.complement(R.equals)(NaN), parseInt), parseInt),
    R.split('.', keyString)
);