const path = require('path');
const webpack = require('webpack');
const BASE = './static';
const JS = path.join(BASE, 'source')

module.exports = {
    devtool: 'inline-source-map',
    resolve: {
      // Looks for sources in BASE as well as node_modules
      // (node_modules is normally the default)
      modules: [
        resolve(JS),
        'node_modules'
      ],
    },
    output: {
        path: path.resolve(path.join(BASE, '/bundles')),
        filename: 'index.js',
    },
};
