import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import buble from 'rollup-plugin-buble'

const env = process.env.NODE_ENV;
const config = {
  input: 'src/index.js',
  plugins: [
    buble(),
    json()
  ]
};

if (env === 'es' || env === 'cjs') {
  config.output = {format: env};
  config.external = ['symbol-observable'];
}

if (env === 'development' || env === 'production') {
  config.output = {format: 'umd'};
  config.name = 'Umd';
  config.plugins.push(
    nodeResolve({
      jsnext: true
    }),
    commonjs({
      include: [
        'node_modules/**'
      ],
      exclude: [
        'node_modules/process-es6/**'
      ],
      namedExports: {
      }
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