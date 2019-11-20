var webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
	entry: {
		client: ["./client/main.js"],
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
		filename: "[name].bundle.js",
		publicPath: "/public/",
		globalObject: `(typeof self !== 'undefined' ? self : this)`
	},
	// output: {
	// 	path: __dirname + '/public',
	// 	filename: '[name].js',
	// 	chunkFilename: '[name].[id].js'
	// },
	module: {
		// noParse: /\.ne$|\.sem$/,
		rules: [
			{
				test: /\.svelte$/,
				use: {
					loader: "svelte-loader",
					options: {
						emitCss: true,
						hotReload: true
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
			}
		]
	},
	mode,
	plugins: [
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
