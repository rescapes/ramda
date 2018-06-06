import nodeResolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import babelrc from 'babelrc-rollup'

const babelConfig = {
  'presets': [
    ['env', {
      'targets': {
        'browsers': ['last 2 versions']
      },
      'loose': true,
      'modules': false
    }]
  ],
  "plugins": [
    "external-helpers"
  ]
};

const env = process.env.NODE_ENV;
const config = {
  input: 'src/index.js',
  plugins: [
    json({
      exclude: 'node_modules/**'
    }),
    babel(babelrc({
      addExternalHelpersPlugin: false,
      config: babelConfig,
      exclude: 'node_modules/**',
      runtimeHelpers: true
    })),
    nodeResolve({
      preferBuiltins: true,
      jsnext: true,
      extensions: [ '.ts', '.js', '.json' ],
      customResolveOptions: {
        moduleDirectory: 'src'
      }
    }),
    commonjs({
      include: [
        'node_modules/**'
      ],
      exclude: [
        'node_modules/process-es6/**'
      ],
      namedExports: {
        'node_modules/react/index.js': ['Children', 'Component', 'PropTypes', 'createElement'],
        'node_modules/react-dom/index.js': ['render']
      }
    })
  ]
};

if (env === 'es' || env === 'cjs') {
  config.output = {format: env};
  config.external = ['symbol-observable'];
}

if (env === 'development' || env === 'production') {
  config.output = {format: 'umd'};
  config.output.name = 'Umd';
  config.plugins.push(
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