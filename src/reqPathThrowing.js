import * as R from "ramda";

import {reqPath} from "./reqPath.js";

/**
 * Calls functions.reqPath and throws if the reqPath does not resolve to a non-nil
 * @params {[String]} Path the Ramda lens style path, e.g. ['x', 1, 'y']
 * @params {Object} obj The obj to query
 * @returns {Object|Exception} The value of the sought path or throws
 * reqPath:: string -> obj -> a or throws
 */
export const reqPathThrowing = R.curry((pathList, obj) =>
    reqPath(pathList, obj).mapError(
        leftValue => {
            // If left throw a helpful error
            throw new Error(
                R.join(' ', [
                        R.ifElse(
                            R.length,
                            resolved => `Only found non-nil path up to ${R.join('.', resolved)}`,
                            R.always('Found no non-nil value')
                        )(leftValue.resolved),
                        `of path ${R.join('.', pathList)} for obj ${inspect(obj, {depth: 3})}`
                    ]
                )
            );
        },
        // If right return the value
        R.identity
    ).unsafeGet()
);