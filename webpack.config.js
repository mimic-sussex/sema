var webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';
const HtmlWebpackPlugin = require("html-webpack-plugin");
const LinkTypePlugin = require("html-webpack-link-type-plugin").HtmlWebpackLinkTypePlugin;
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
	// entry: {
	// 	client: ["./client/main.js"],
	// 	workerParser: ["./workerParser/index.js"]
	// },
	entry: {
		bundle: ["./client/main.js"],
		workerParser: ["./workerParser/index.js"]
	},
	resolve: {
		alias: {
			svelte: path.resolve("node_modules", "svelte")
		},
		extensions: [".mjs", ".js", ".svelte"],
		mainFields: ["svelte", "browser", "module", "main"]
	},
	output: {
		path: path.join(__dirname, "public"),
		filename: "[name].js",
		chunkFilename: "[name].[id].js",
		// publicPath: "/public/",
		globalObject: `(typeof self !== 'undefined' ? self : this)`
	},
	module: {
		rules: [
			{
				test: /\.worker\.js$/,
				use: {
					loader: "worker-loader",
					options: {
						name: "workerParser.js"
					}
				}
			},
			{
				test: /\.svelte$/,
				use: {
					loader: "svelte-loader",
					options: {
						emitCss: true,
						hotReload: true,
						dev: true
					}
				}
			},
			{
				test: /\.css$/,
				use: [
					/**
					 * MiniCssExtractPlugin doesn't support HMR.
					 * For developing, use 'style-loader' instead.
					 * */
					prod ? MiniCssExtractPlugin.loader : "style-loader",
					"css-loader"
				]
			},
			{
				test: /\.ne$/,
				use: ["raw-loader"]
			},
			{
				test: /\.tf$/i,
				loader: ["raw-loader"]
			},
			{
				test: /\.sem$/,
				use: ["raw-loader"]
			},
			{
				// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
				// Emscripten JS files define a global. With `exports-loader` we can
				// load these files correctly (provided the global’s name is the same
				// as the file name).
				test: /maxi-processor.js/,
				// loader: 'exports-loader',
				// loader: 'worklet-loader',
				loader: "file-loader", // files should NOT get processed, only emitted
				options: {
					name: "maxi-processor.js"
				}
			},
			{
				//WASM LOADER
				// Issue pointed out by Surma on the following gist – https://gist.github.com/surma/b2705b6cca29357ebea1c9e6e15684cc
				// wasm files should not be processed but just be emitted
				// and we want to have their public URL.
				test: /maximilian.wasmmodule.js$/,
				type: "javascript/auto",
				// loader: 'wasm-loader', // WASM files get processed [NOT what we want]
				loader: "file-loader", // WASM files are only emitted to the final dist, NOT processed
				options: {
					// mimetype: 'application/wasm',
					name: "maximilian.wasmmodule.js"
				}
			},
			{
				//AUDIO SAMPLE LOADER
				test: /\.(mp3|wav)$/,
				use: {
					loader: "file-loader",
					options: {
						name: "[name].[ext]",
						outputPath: "samples"
					}
				}
			}
		]
	},
	mode,
	plugins: [
		new HtmlWebpackPlugin({
			template: "index.html"
		}),
		new LinkTypePlugin({
			"**/*.css": "text/css"
		}),
		// new webpack.HotModuleReplacementPlugin(),
		// new webpack.NoEmitOnErrorsPlugin(),
		new MiniCssExtractPlugin({
			filename: "[name].css"
		})
	],
	devtool: prod ? false : "source-map",
	node: {
		fs: "empty"
	}
};
