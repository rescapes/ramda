// Original source
// https://gist.github.com/plukevdh/dec4b41d5b7d67f83be630afecee499e
import * as R from 'ramda';

const isObject = R.compose(R.equals('Object'), R.type);
const allAreObjectsOrLists = R.compose(R.either(R.all(isObject), R.all(Array.isArray)), R.values);
const hasVersion = versionLabel => obj => R.has(versionLabel, obj);
const hasBoth = versionLabels => obj => R.all(versionLabel => hasVersion(versionLabel)(obj), versionLabels);
const isEqual = versionLabels => obj => R.both(
  hasBoth(versionLabels),
  R.compose(
    R.apply(R.equals),
    R.values
  )
)(obj);

const markAdded = obj => R.compose(R.append(undefined), R.values)(obj); // eslint-disable-line no-undefined
const markRemoved = obj => R.compose(R.prepend(undefined), R.values)(obj); // eslint-disable-line no-undefined
const isAddition = versionLabels => obj => R.both(
  hasVersion(R.head(versionLabels)),
  R.complement(hasVersion(R.last(versionLabels)))
)(obj);
const isRemoval = versionLabels => obj => R.both(
  R.complement(
    hasVersion(R.head(versionLabels))
  ),
  hasVersion(R.last(versionLabels))
)(obj);

/**
 * Diffs objects and replaces differences with an object {__left: left value, __right: right value}
 * @param {[String]} Two values indicating the names of the versions. If left null then __left and __right
 * are used for the diff
 * @param {Object} l The left object to diff
 * @param {Object} r The right object to diff
 * @returns {Object} A deep diff of l and r. Equal values are removed, different values are replaced by an
 * object keyed by the two version strings with the corresponding values
 */
export const objectDiff = R.curry((versionLabels, l, r) => {
  const labels = R.defaultTo(['__left', '__right'], versionLabels);
  const [left, right] = labels;
  return R.compose(
    result => R.map(
      R.cond([
          [obj => isAddition(labels)(obj),
            obj => markAdded(obj)
          ],
          [obj => isRemoval(labels)(obj),
            obj => markRemoved(obj)
          ],
          [obj => hasBoth(labels)(obj),
            obj => R.when(
              allAreObjectsOrLists,
              // If all are objects or list recurse
              // Lists necessary become objects keyed by index since some indices are removed
              o => R.compose(
                // Remove the left, right labels and recurse
                values => R.apply(objectDiff(versionLabels), values),
                R.values
              )(o)
              // Otherwise we keep the left and right labels and we are done
            )(obj)
          ]
        ]
      ), result),
    result => R.reject(obj => isEqual(labels)(obj), result),
    R.useWith(
      R.mergeWith(R.merge),
      [
        R.map(R.objOf(left)),
        R.map(R.objOf(right))
      ]
    )
  )(l, r);
});

/**
 * Pretty-prints objectDiff
 * @param {[String]} versionLabels The two labels or null
 * @param {Object} l The left-side value
 * @param {Object} r The right-side value
 * @returns {String} The diff string
 */
export const prettyPrintObjectDiff = (versionLabels, l, r) => {
  return R.compose(
    result => JSON.stringify(result, null, 2),
    objectDiff
  )(versionLabels, l, r);
};
