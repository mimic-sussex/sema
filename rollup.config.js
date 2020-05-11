import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import del from "del";
import copyAssets from "rollup-plugin-copy-assets";
import webWorkerLoader from "rollup-plugin-web-worker-loader";

// export default {
// 	entry: "client/index.js",
// 	format: "esm",
// 	input: "client/index.js",
// 	output: {
// 		file: "public/bundle.js",
// 		format: "cjs",
// 	},
// 	plugins: [
// 		copyAssets({
// 			assets: [
// 				// You can include directories
// 				"assets",
// 				// "src/assets",
// 				// You can also include files
// 				"src/external/buffer.bin",
// 			],
// 		}),
// 		webWorkerLoader(/* configuration */),
// 	],
// };

export default {
	// input: 'src/main.js',
	input: "client/main.js",
	output: {
		sourcemap: true,
		// format: "iife",
		format: "esm",
		name: "app",
		file: "public/bundle.js", //set "output.dir" instead of "output.file" when generating multiple chunks.
		// dir: "public/build/"
		// external: ["moment"],
	},

	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
			css: (css) => {
				css.write("public/build/bundle.css");
			},
		}),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		resolve({
			browser: true,
			// dedupe: importee => importee === "svelte" || importee.startsWith("svelte/")
			dedupe: [
				"svelte",
				"svelte-codemirror",
				"svelte-inspect",
				"svelte-grid",
				"codemirror/mode/javascript/javascript",
				"codemirror/keymap/vim.js",
			],
		}),
		copyAssets({
			assets: [
				// You can include directories
				"assets",
				// "src/assets",
				// You can also include files
				"src/external/buffer.bin",
			],
		}),
		webWorkerLoader(/* configuration */),
		url({
			limit: 10 * 1024, // inline files < 10k, copy files > 10k
			include: [
				// "**/*.svg",
				"client/compiler/*.ne",
				"client/compiler/*.sem",
				"client/machineLearning/tfjs/rnn/lstm-txt-gen.tf",
				"client/machineLearning/tfjs/hello-world/hello-world.tf",
				"client/machineLearning/tfjs/non-linear/two-layer-non-linear.tf",
				"client/machineLearning/tfjs/non-linear/binary-classification.tf",
				"client/machineLearning/tfjs/echo-state/echo-state-network.tf",
				"client/machineLearning/magenta/music-rnn.tf",
			], // defaults to .svg, .png, .jpg and .gif files
			emitFiles: true, // defaults to true
		}),
		commonjs({
			namedExports: {
				"nearley/lib/nearley-language-bootstrapped": [
					"Lexer",
					"ParserStart",
					"ParserRules",
				],
			},
		}),

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload("public"),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),
	],
	watch: {
		clearScreen: false,
	},
};



function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require("child_process").spawn("npm", ["run", "start", "--", "--dev"], {
					stdio: ["ignore", "inherit", "inherit"],
					shell: true,
				});
			}
		},
	};
}