import copy from "rollup-plugin-copy-assets";
import webWorkerLoader from "rollup-plugin-web-worker-loader";

export default {
	entry: "client/index.js",

	format: "esm",
	input: "client/index.js",
	output: {
		file: "public/bundle.js",
		format: "cjs",
	},
	plugins: [
		copy({
			assets: [
				// You can include directories
				"src/assets",
				// You can also include files
				"src/external/buffer.bin",
			],
		}),
    webWorkerLoader(/* configuration */)
	],
};
