const path = require('path');
const webpack = require('webpack');

module.exports = {
    devtool: 'inline-source-map',
    entry: [
      path.resolve(path.join(__dirname, '/index.js'))
    ],
    resolve: {
      modules: [
        path.resolve(path.join(__dirname, '/src/')),
        'node_modules'
      ],
    },
    output: {
      path: path.join(__dirname, '/dist/'),
      filename: 'index.js',
      publicPath: '/'
    }
};
