const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';
const HtmlWebpackPlugin = require("html-webpack-plugin");
const LinkTypePlugin = require("html-webpack-link-type-plugin").HtmlWebpackLinkTypePlugin;
const WorkerPlugin = require("worker-plugin");
const { CleanPlugin } = require("clean-webpack-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CopyWebpackPlugin = require("copy-webpack-plugin");


module.exports = {
	entry: {
		bundle: ["./client/main.js"],
		// parser: ["./workers/parser.worker.js"],
		// ml: ["./workers/ml.worker.js"],
		// il: ["./workers/il.worker.js"]
	},
	resolve: {
		alias: {
			svelte: path.resolve("node_modules", "svelte"),
		},
		extensions: [".mjs", ".js", ".svelte"],
		mainFields: ["svelte", "browser", "module", "main"],
	},
	output: {
		path: path.join(__dirname, "public"),
		filename: "[name].js",
		chunkFilename: "[name].[id].js",
		// publicPath: "/public/",
		globalObject: `(typeof self !== 'undefined' ? self : this)`,
	},
	module: {
		rules: [
			// {
			// 	test: /workers\/libs\/lalolib\.js/,
			// 	use: {
			// 		loader: "file-loader",
			// 	},
			// },
			{
				test: /\.js$/,
				exclude: [
					path.resolve(__dirname, "client/workers/il.worker.js"),
					path.resolve(__dirname, "client/workers/parser.worker.js"),
					path.resolve(__dirname, "client/workers/ml.worker.js"),
					path.resolve(__dirname, "client/workers/tfjs.min.js"),
				],
			},
			{
				test: /\.svelte$/,
				use: {
					loader: "svelte-loader",
					options: {
						emitCss: true,
						hotReload: true,
						dev: true,
					},
				},
			},
			{
				test: /\.css$/,
				// exclude: [ path.resolve(__dirname, "client/global.css") ],
				use: [
					/**
					 * MiniCssExtractPlugin doesn't support HMR.
					 * For developing, use 'style-loader' instead.
					 * */
					prod ? MiniCssExtractPlugin.loader : "style-loader",
					"css-loader",
				],
			},
			// {
			// 	test: /tutorial.json/,
			// 	loader: "file-loader",
			// 	options: {
			// 		name: "tutorial.json",
			// 	},
			// },
			{
				test: /\.glsl$/,
				loader: "file-loader", // files should NOT get processed, only emitted
				// include: ['./**/*.glsl', '../../../**/*.glsl'],
				options: {
					compress: false,
					name: "[name].glsl",
				},
			},

			{
				test: /\.ne$/,
				use: ["raw-loader"],
			},
			{
				test: /\.tf$/i,
				loader: ["raw-loader"],
			},
			{
				test: /\.sem$/,
				use: ["raw-loader"],
			},
			{
				test: /maxi-processor.js/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "maxi-processor.js",
				},
			},
			{
				test: /lalolib.js/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "lalolib.js",
				},
			},
			{
				test: /svd.js/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "svd.js",
				},
			},
			{
				test: /lodash.js/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "lodash.js",
				},
			},
			{
				test: /tfjs.js/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "tfjs.js",
				},
			},
			{
				//WASM LOADER
				// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
				// wasm files should not be processed but just be emitted
				// and we want to have their public URL.

				//note - need to import this in audioengine.js to get webpack to trigger this filter

				test: /maximilian.wasmmodule.js$/,
				type: "javascript/auto",
				// loader: 'wasm-loader', // WASM files get processed [NOT what we want]
				loader: "file-loader", // WASM files are only emitted to the final dist, NOT processed
				options: {
					// mimetype: 'application/wasm',
					name: "maximilian.wasmmodule.js",
				},
			},
			{
				//WASM LOADER
				// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
				// wasm files should not be processed but just be emitted
				// and we want to have their public URL.

				//note - need to import this in audioengine.js to get webpack to trigger this filter

				test: /open303.wasmmodule.js$/,
				type: "javascript/auto",
				// loader: 'wasm-loader', // WASM files get processed [NOT what we want]
				loader: "file-loader", // WASM files are only emitted to the final dist, NOT processed
				options: {
					// mimetype: 'application/wasm',
					name: "open303.wasmmodule.js",
				},
			},
			{
				//WASM LOADER
				// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
				// wasm files should not be processed but just be emitted
				// and we want to have their public URL.

				//note - need to import this in audioengine.js to get webpack to trigger this filter

				test: /maximilian.transpile.js$/,
				type: "javascript/auto",
				// loader: 'wasm-loader', // WASM files get processed [NOT what we want]
				loader: "file-loader", // WASM files are only emitted to the final dist, NOT processed
				options: {
					// mimetype: 'application/wasm',
					name: "maximilian.transpile.js"
				}
			},
			{
				//IMAGE LOADER
				test: /\.(jpe?g|png|gif|svg)$/i,
				loader: "file-loader",
			},
			{
				test: /favicon.ico/,
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "favicon.ico",
				},
			},
			{
				//AUDIO SAMPLE LOADER
				test: /\.(mp3|wav)$/,
				use: {
					loader: "file-loader",
					options: {
						name: "[name].[ext]",
						outputPath: "samples",
					},
				},
			},
		],
	},
	mode,
	plugins: [
		new webpack.ProgressPlugin(),
		new CopyWebpackPlugin([
			{
				context: "./assets",
				from: "tutorial",
				to: "tutorial",
				toType: "dir",
			},
		]),
		new HtmlWebpackPlugin({
			noscriptHeader:
				"To run Sema, please enable Javascript in the browser configuration",
			template: "./client/index.html",
			filename: "./index.html", //relative to root of the application
			excludeChunks: ["worker"],
		}),
		new LinkTypePlugin({
			"**/*.css": "text/css",
		}),
		new MiniCssExtractPlugin({
			filename: "[name].css",
		}),
		new WorkerPlugin(),

		// new CleanWebpackPlugin()

		// new webpack.HotModuleReplacementPlugin(),
		// new webpack.NoEmitOnErrorsPlugin(),
	],
	devtool: prod ? false : "source-map",
	// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
	// This is necessary due to the fact that emscripten puts both Node and web
	// code into one file. The node part uses Node’s `fs` module to load the wasm
	// file.
	// Issue: https://github.com/kripken/emscripten/issues/6542.
	// browser: {
	//   "fs": false
	// },
	// There is a further correction on the thread, which is congruent with what I had before
	node: {
		fs: "empty",
	},
};
