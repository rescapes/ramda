import {uglify} from 'rollup-plugin-uglify';
import nodeResolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import {terser} from 'rollup-plugin-terser';
import pkg from './package.json';
import * as R from 'ramda'
const env = process.env.NODE_ENV;

const config = {
  input: [
    'src/index.js',
    'src/functions.js',
    'src/throwingFunctions.js',
    'src/monadHelpers.js'
  ],
  plugins: []
};

const externals = ['symbol-observable', 'folktale/concurrency/task', 'folktale/result'];
config.plugins.push(
  babel({
    exclude: ['node_modules/**']
  })
);

config.plugins.push(
  nodeResolve({}),
  replace({
    'process.env.NODE_ENV': JSON.stringify(env)
  })
);

const configs = R.map(c => R.merge(config, c), [
  // CommonJS
  {
    output: {dir: 'lib', format: 'cjs', indent: false},
    external: [
      ...externals,
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ],
    plugins: R.concat(config.plugins, [babel()])
  },

  // ES
  {
    input: 'src/index.js',
    output: {file: 'es', format: 'es', indent: false},
    external: [
      ...externals,
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ],
    plugins: R.concat(config.plugins, [babel()])
  },

  // ES for Browsers
  {
    input: 'src/index.js',
    output: {file: 'es/redux.mjs', format: 'es', indent: false},
    plugins: R.concat(config.plugins, [
      nodeResolve({
        jsnext: true
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      terser({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false
        }
      })
    ])
  },

  // UMD Development
  {
    input: 'src/index.js',
    output: {
      file: 'dist/redux.js',
      format: 'umd',
      name: 'Redux',
      indent: false
    },
    plugins: R.concat(config.plugins, [
      nodeResolve({
        jsnext: true
      }),
      babel({
        exclude: 'node_modules/**'
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify('development')
      })
    ])
  },

  // UMD Production
  {
    input: 'src/index.js',
    output: {
      file: 'dist/redux.min.js',
      format: 'umd',
      name: 'Redux',
      indent: false
    },
    plugins: R.concat(config.plugins, [
      nodeResolve({
        jsnext: true
      }),
      babel({
        exclude: 'node_modules/**'
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      terser({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false
        }
      })
    ])
  }
]);
export default configs