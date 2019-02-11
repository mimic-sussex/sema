"use strict";

// Required packages
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const outputDir = "./build/";

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, outputDir)
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    }]
  },
  plugins: [
    new CleanWebpackPlugin([outputDir]),
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'handlebars', 'html', 'css']
    })
  ]
};
