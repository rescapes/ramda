import * as R from "ramda";

import {reqPathThrowing} from "./reqPathThrowing.js";
import {keyStringToLensPath} from "./keyStringToLensPath.js";

/**
 * Expects a prop path and returns a function expecting props,
 * which resolves the prop indicated by the string. Throws if there is no match.
 * Any detected standalone numbrer is assumed to be an index and converted to an int
 * @param {String} str dot-separated prop path
 * @param {Object} props Object to resolve the path in
 * @return {function(*=)}
 */
export const reqStrPathThrowing = R.curry(
    (str, props) => {
        return reqPathThrowing(keyStringToLensPath(str), props);
    }
);