"use strict";

// Required packages
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

const outputDir = "dist";

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  node: {
    fs: 'empty'
  },
  devtool: "source-map",
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, outputDir),
    // publicPath: 'public',
  },

  resolve: {
    extensions: [".js", ".json", ".wasm"]
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.wasm$/,
        loader: 'file-loader',
      },
      {
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
    open: true
    // historyApiFallback: true,
    // hot: true,
    // publicPath: '/public',
    // inline: true,
    // overlay: true,
    // contentBase: './dist',
  },
  plugins: [
    new CleanWebpackPlugin([outputDir]),
    new HtmlWebpackPlugin({
      title: 'Development',
      template: './src/index.html'
    })
  ],
};
