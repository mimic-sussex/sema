"use strict";

// Required packages
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");

const outputDir = "./build/";

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  node: {
    fs: 'empty'
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, outputDir)
  },
  module: {
    rules: [{
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    },
    {
      test: /\.mp3$/,
      loader: 'file-loader'
    }
  ]
  },
  plugins: [
    new CleanWebpackPlugin([outputDir]),
  
  ]
};
