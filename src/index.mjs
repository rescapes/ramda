/**
 * Created by Andy Likuski on 2017.09.04
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export {
  strPathTruthyOr,
  strPathsOr,
  pathOr,
  strPathOrNullOk,
  strPathsOrNullOk,
  eqStrPath,
  eqStrPathsAll,
  eqStrPathsAllCustomizable,
  strPathEq,
  hasStrPath,
  reqPath,
  reqPathPropEq,
  strPath,
  reqStrPath,
  strPathOr
} from './propPathFunctions.js'

export {
  camelCase,
  capitalize,
  compact,
  compactEmpty,
  compactJoin,
  duplicateKey,
  emptyToNull,
  filterWithKeys,
  findOne,
  findByParams,
  findOneValueByParams,
  findMapped,
  findMappedAndResolve,
  mapKeysAndValues,
  idOrIdFromObj,
  lowercase,
  mapDefault,
  mapDefaultAndPrefixOthers,
  mapKeys,
  mapKeysForLens,
  mapProp,
  mapPropValueAsIndex,
  mapToObjValue,
  mergeAllWithKey,
  mergeDeep,
  mergeDeepAll,
  mergeDeepWith,
  mergeDeepWithConcatArrays,
  mergeDeepWithKeyWithRecurseArrayItemsAndMapObjs,
  mergeDeepWithRecurseArrayItems,
  mergeDeepWithRecurseArrayItemsByRight,
  mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight,
  moveToKeys,
  onlyOne,
  onlyOneValue,
  orEmpty,
  alwaysFunc,
  removeDuplicateObjectsByProp,
  renameKey,
  transformKeys,
  mapObjToValues,
  chainObjToValues,
  fromPairsDeep,
  replaceValuesAtDepth,
  replaceValuesAtDepthAndStringify,
  replaceValuesWithCountAtDepth,
  replaceValuesWithCountAtDepthAndStringify,
  flattenObj,
  flattenObjUntil,
  unflattenObjNoArrays,
  unflattenObj,
  filterObjToValues,
  overDeep,
  keyStringToLensPath,
  omitDeep,
  omitDeepPaths,
  omitDeepBy,
  pickDeepPaths,
  applyDeep,
  applyDeepWithKeyWithRecurseArraysAndMapObjs,
  splitAtInclusive,
  toArrayIfNot,
  isObject
} from './functions.js';

export {
  throwIfSingleResultError,
  mappedThrowIfResultError,
  throwIfResultError,
  findOneThrowing,
  findOneValueByParamsThrowing,
  onlyOneThrowing,
  onlyOneValueThrowing,
} from './throwingFunctions.js';

export {
  reqPathPropEqThrowing,
  reqPathThrowing,
  reqStrPathThrowing
} from './propPathFunctionsThrowing.js'

export {
  defaultRunConfig,
  defaultRunToResultConfig,
  promiseToTask,
  taskToPromise,
  resultToTask,
  resultToTaskNeedingResult,
  resultToTaskWithResult,
  lift1stOf2ForMDeepMonad,
  objOfMLevelDeepListOfMonadsToListWithPairs,
  objOfMLevelDeepMonadsToListWithPairs,
  pairsOfMLevelDeepListOfMonadsToListWithPairs,
  traverseReduce,
  traverseReduceDeep,
  traverseReduceWhile,
  traverseReduceWhileBucketed,
  traverseReduceWhileBucketedTasks,
  traverseReduceError,
  traverseReduceResultError,
  mapMDeep,
  traverseReduceDeepResults,
  resultTasksToResultObjTask,
  resultsToResultObj,
  chainMDeep,
  mapExceptChainDeepestMDeep,
  chainExceptMapDeepestMDeep,
  doMDeep,
  doMDeepExceptDeepest,
  mapToResponseAndInputs,
  mapToMergedResponseAndInputs,
  mapToMergedResponseAndInputsMDeep,
  mapToNamedResponseAndInputs,
  mapToNamedResponseAndInputsMDeep,
  mapToPath,
  mapWithArgToPath,
  mapToNamedPathAndInputs,
  mapResultMonadWithOtherInputs,
  toNamedResponseAndInputs,
  mapOrObjToNamedResponseAndInputs,
  toMergedResponseAndInputs,
  mapResultTaskWithOtherInputs,
  taskToResultTask,
  waitAllBucketed,
  sequenceBucketed,
  composeWithChain,
  composeWithChainMDeep,
  composeWithMapExceptChainDeepestMDeep,
  composeWithMap,
  composeWithMapMDeep,
  retryTask,
  mapMonadByConfig,
 isResolvePropPathForAllSets
} from './monadHelpers.js';
export {memoized, memoizedWith, memoizedTaskWith} from './memoizeHelpers.js';
export {objectDiff, prettyPrintObjectDiff} from './diffHelpers.js';
export {stringifyError} from './errorHelpers.js';
export {expectKeys, expectKeysAtPath, expectTask, resultToPromise} from './testHelpers.js';
export {defaultNode} from './nodeHelpers.js'
