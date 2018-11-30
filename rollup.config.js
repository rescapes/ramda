import nodeResolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import { uglify } from 'rollup-plugin-uglify';
import autoExternal from 'rollup-plugin-auto-external';

const env = process.env.NODE_ENV;
const config = {
  input: [
    'src/index.js',
    'src/functions.js',
    'src/throwingFunctions.js',
    'src/monadHelpers.js'
  ],
  plugins: [
    // Automatically exclude dependencies and peerDependencies from cjs and es builds, (and excludes
    // peerDependencies from all builds)
    autoExternal()
  ],
  experimentalCodeSplitting: true
};

if (env === 'es' || env === 'cjs') {
  config.output = {
    dir: env,
    format: env,
    indent: false,
    sourcemap: 'inline'
  };
  // folktale needs to be explicitly external because rollup can't
  // match folktale to folktale/concurrency/task
  config.external = ['symbol-observable', 'folktale/concurrency/task', 'folktale/result']
  config.plugins.push(
    babel({
      exclude: ['node_modules/**'],
      plugins: ['external-helpers']
    })
  );
}

if (env === 'development' || env === 'production') {
  config.output = {
    dir: 'umd',
    format: 'umd',
    name: 'Umd',
    indent: false
  };
  config.plugins.push(
    nodeResolve({
      jsnext: true
    }),
    babel({
      exclude: 'node_modules/**',
      plugins: ['external-helpers']
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env)
    })
  );
}

if (env === 'production') {
  config.plugins.push(
    uglify({
      compress: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false
      }
    })
  );
}

export default config;