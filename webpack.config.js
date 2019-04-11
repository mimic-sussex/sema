"use strict";

// Required packages
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {

  mode: 'development',
  entry: './src/index.js',

  devtool: "source-map",
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    // publicPath: 'public',
  },
  // Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
  // This is necessary due to the fact that emscripten puts both Node and web
  // code into one file. The node part uses Node’s `fs` module to load the wasm
  // file.
  // Issue: https://github.com/kripken/emscripten/issues/6542.
  // browser: {
  //   "fs": false
  // },
  // There is a further correction on the thread, which is congruent with what I had befor
  node: {
    fs: 'empty'
  },
  resolve: {
    extensions: [".js", ".json", ".wasm"]
  },
  module: {
    rules: [
      {
        // Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
        // Emscripten JS files define a global. With `exports-loader` we can
        // load these files correctly (provided the global’s name is the same
        // as the file name).
        test: /maxi-processor.js/,
        // loader: 'exports-loader',
        // loader: 'worklet-loader',
        loader:'file-loader',  // files should NOT get processed, only emitted
        options: {
           name: '[hash].maxi-processor.js'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        //IMAGE LOADER
        test: /\.(jpe?g|png|gif|svg)$/i,
        loader:'file-loader'
      },
      {
        //WASM LOADER
        // Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
        // wasm files should not be processed but just be emitted and we want
        // to have their public URL.
        test: /maximilian\.wasmmodule\.js$/,
        type: 'javascript/auto',
        loader: 'file-loader',    // WASM files should NOT get processed, only emitted
        // loader: 'wasm-loader', // WASM files get processed
        options: {
          // name: '[name].[ext]',
          publicPath: "dist/"
        }
      },
      {
        //AUDIO SAMPLE LOADER
        test: /\.(mp3|wav)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: "[name].[ext]",
            outputPath: './samples/'
          },
        },
      },
      {
        //FONT LOADER
        test: /\.(ttf|eot|woff|woff2)$/,
        use: {
          loader: "file-loader",
          options: {
            mimetype: 'application/font-woff',
            name: "[name].[ext]",
            // publicPath: '../public',
            // publicPath: 'fonts/'
          },
        },
      },
    ]
  },
  devServer: {
    clientLogLevel: 'warning',
    host: 'localhost',
    port: 9001,
    open: true,
    hot: true,
    // mimeTypes: { typeMap: { 'application/wasm': [ 'wasm' ] } }
    // historyApiFallback: true,

    // publicPath: '/public',
    // inline: true,
    // overlay: true,
    // contentBase: './dist',
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      title: 'Development',
      template: './src/index.html',
      favicon: "./assets/img/favicon.ico"
    }),
    new webpack.HotModuleReplacementPlugin()
    ],
};
