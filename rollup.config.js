import svelte from 'rollup-plugin-svelte-hot'
import Hmr from 'rollup-plugin-hot'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import { copySync, removeSync } from 'fs-extra'
import { spassr } from 'spassr'
import getConfig from '@roxi/routify/lib/utils/config'
import autoPreprocess from 'svelte-preprocess'
import postcssImport from 'postcss-import'
import { injectManifest } from 'rollup-plugin-workbox'
import copy from 'rollup-plugin-copy'
import url from '@rollup/plugin-url'
import dynamicImportVariables from 'rollup-plugin-dynamic-import-variables'
import { join } from 'path'
import { string } from 'rollup-plugin-string'
import workerLoader from 'rollup-plugin-web-worker-loader'
import { wasm } from '@rollup/plugin-wasm'
import sourcemaps from 'rollup-plugin-sourcemaps'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import { config } from 'dotenv'
// import cors from 'cors';


const { distDir } = getConfig() // use Routify's distDir for SSOT
const assetsDir = 'assets'
const buildDir = `${distDir}/build`
const isNollup = !!process.env.NOLLUP
const production = !process.env.ROLLUP_WATCH;

// clear previous builds
removeSync(distDir)
removeSync(buildDir)


// Silence warning
const onwarn = (warning, warn) =>  {
	// suppress eval warnings
	if (warning.code === 'EVAL') return
	warn(warning)
}

const serve = () => ({
    writeBundle: async () => {
        const options = {
            assetsDir: [assetsDir, distDir],
            entrypoint: `${assetsDir}/__app.html`,
            script: `${buildDir}/main.js`
        }

				// SPA server
        spassr({
					...options,
					port: 5001,
					middleware: (server) => {
						// server.use(cors());


						server.use((req, res, next) => {
							res.set({
								'Cross-Origin-Opener-Policy': 'same-origin',
								'Cross-Origin-Embedder-Policy': 'require-corp',
								'Cross-Origin-Resource-Policy': 'cross-origin',
								'Access-Control-Allow-Origin': [
									// 'livereload.js?snipver=1',
									// '/livereload.js?snipver=1',
									'http://localhost:35729/livereload.js?snipver=1',
									'http://localhost:35729/',
									'https://www.youtube.com/embed/Qw4sYnTj-Ow?t=27s',
									'*',
								],
								'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
								'Access-Control-Allow-Headers':
									'Content-Type, X-Requested-With, Content-Type, Accept',
							})
							console.log('Time: %d', Date.now())
							// console.log(req)
							next()
						})

						// server.get(
						// 	// 'livereload.js?snipver=1',
						// 	'http://localhost:35729/livereload.js?snipver=1',
						// 	// cors(),
						// 	function (req, res) {
						// 		console.log('livereload')
						// 		res.set({
						// 			'Cross-Origin-Resource-Policy': 'same-site',
						// 			'Access-Control-Allow-Origin': [
						// 				'*',
						// 			],
						// 			'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
						// 			'Access-Control-Allow-Headers':
						// 				'Content-Type, X-Requested-With, Content-Type, Accept',
						// 		})
						// 		next()
						// 	}
						// )

						// server.get(
						// 	// 'Qw4sYnTj-Ow?t=27s',
						// 	'https://www.youtube.com/embed/Qw4sYnTj-Ow?t=27s',
						// 	cors(),
						// 	function (req, res) {
						// 	res.set({
						// 		'Cross-Origin-Resource-Policy': 'cross-origin',
						// 		'Access-Control-Allow-Origin': ['*'],
						// 		'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
						// 		'Access-Control-Allow-Headers':
						// 			'Content-Type, X-Requested-With, Content-Type, Accept',
						// 	})
						// 	next()
						// })



					}
				})

				// SSR server
				spassr({
					...options,
					ssr: true,
					port: 5005,
					ssrOptions: {
						inlineDynamicImports: true,
						dev: true,
					},
					middleware: (server) => {
						// server.use(cors());
						// server.get('livereload.js?snipver=1', cors(), function (req, res) {
						// 	res.set({
						// 		'Cross-Origin-Resource-Policy': 'same-site',
						// 		'Access-Control-Allow-Origin': ['http://localhost:35729/', '*'],
						// 		'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
						// 		'Access-Control-Allow-Headers':
						// 			'Content-Type, X-Requested-With, Content-Type, Accept',
						// 	})
						// 	next();
						// })

						// server.get('Qw4sYnTj-Ow?t=27s', cors(), function (req, res) {
						// 	res.set({
						// 		'Cross-Origin-Resource-Policy': 'cross-origin',
						// 	})
						// 	next();
						// })

						// server.use((req, res, next) => {
						// 	res.set({
						// 		'Cross-Origin-Opener-Policy': 'same-origin',
						// 		'Cross-Origin-Embedder-Policy': 'require-corp',
						// 		'Cross-Origin-Resource-Policy': 'cross-origin',
						// 		'Access-Control-Allow-Origin': [
						// 			'http://localhost:35729/',
						// 			'*',
						// 		],
						// 		'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
						// 		'Access-Control-Allow-Headers':
						// 			'Content-Type, X-Requested-With, Content-Type, Accept',
						// 	}),
						// 	console.log('Time@SSR: %d', Date.now())
						// 	next()
						// })
					}
				})
    }
})

const copyToDist = () => ({ writeBundle() { copySync(assetsDir, distDir) } })


export default {
	preserveEntrySignatures: false,
	onwarn,
	input: [`src/main.js`],
	output: {
		sourcemap: true,
		format: 'esm',
		dir: buildDir,
		// for performance, disabling filename hashing in development
		// chunkFileNames: `[name]${(production && '-[hash]') || ''}.js`,
	},
	plugins: [
		svelte({
			emitCss: false,
			hot: isNollup,
			preprocess: [
				autoPreprocess({
					postcss: { plugins: [postcssImport()] },
					defaults: { style: 'postcss' },
				}),
			],
		}),
		copy({
			targets: [
				{
					// ! NOTE `!${staticDir}/samples` a negated pattern for the assets/samples directory,
					// ! we want to prevent assets/samples from being copied
					// ! and have them emitted (not inlined) by the plugin-URL
					src: [
						'!*/(__index.html)',
						'!assets/samples/*',
						// `!${assetsDir}/samples/*`,
						`${assetsDir}/*`,
					],
					dest: distDir,
				},
				{
					src: [
						'node_modules/sema-engine/maxi-processor.js',
						// 'node_modules/sema-engine/sema-engine.wasmmodule.js',
						// 'node_modules/sema-engine/open303.wasmmodule.js',
						// 'node_modules/sema-engine/ringbuf.js',
						// 'node_modules/sema-engine/transducers.js',
						// 'node_modules/sema-engine/lalolib.js',
						// 'node_modules/sema-engine/svd.js',
					],
					// dest: `${buildDir}`,
					dest: distDir,
				},
			],
			copyOnce: true,
			flatten: false,
			verbose: true,
		}),

		// resolve matching modules from current working directory
		resolve({
			browser: true,
			dedupe: (importee) => !!importee.match(/svelte(\/|$)/),
		}),
		commonjs(),
		dynamicImportVariables({
			exclude: [
				'assets/languages/**/grammar.ne',
				'assets/languages/**/code.sem',
				'assets/learners/**/*.tf',
				'assets/layouts/*.json',
			], // options
			include: ['**/*.wav'],
			warnOnError: true,
		}),
		// globImport(),
		url({
			// include: ['**/*.wav'],
			include: ['assets/samples/*.wav'],
			// include: ['**/*.wav'],
			// publicPath: 'samples',
			limit: 10, // 10 kb
			// // publicPath: '/batman/',
			emitFiles: true,
			fileName: '[name][extname]', // '[name][extname]' 'dist/build/'
			// sourceDir: join(__dirname, 'assets/samples'), // 'dist/assets/samples'
			// sourceDir: join(__dirname, 'src/samples'), // 'dist/assets/samples'
			sourceDir: __dirname, // 'dist/build/assets/samples'
			// sourceDir: join(__dirname, 'src/samples'), // 'dist/assets/samples'
			destDir: join(__dirname, 'dist/sema-engine/samples'), // 'dist/assets/samples'
			// destDir: join(__dirname, `${distDir}/sema-engine/samples`), // 'dist/assets/samples'
			// destDir: __dirname,
		}),
		replace({
			// preventAssignment: true,
			__api: JSON.stringify({
				env: {
					// isProd: production,
					...config().parsed, // attached the .env config
				},
			}),
		}),
		json(),
		string({
			include: [
				'assets/languages/**/grammar.ne',
				'assets/languages/**/code.sem',
				'assets/learners/**/*.tf',
				// 'assets/layouts/*.json',
			],
		}),
		workerLoader(),
		wasm(),
		sourcemaps(),

		production && terser(),
		!production && !isNollup && serve(),
		!production && !isNollup && livereload(distDir), // refresh entire window when code is updated
		!production && isNollup && Hmr({ inMemory: true, public: assetsDir }), // refresh only updated code
		{
			// provide node environment on the client
			// transform: (code) => ({
			// 	code: code.replace(
			// 		/process\.env\.NODE_ENV/g,
			// 		`"${process.env.NODE_ENV}"`
			// 	),
			// 	map: { mappings: '' },
			// }),
		},
		injectManifest({
			globDirectory: assetsDir,
			globPatterns: ['**/*.{js,css,svg}', '__app.html'],
			swSrc: `src/sw.js`,
			swDest: `${distDir}/serviceworker.js`,
			maximumFileSizeToCacheInBytes: 10000000, // 10 MB,
			mode: 'production',
		}),
		production && copyToDist(),
		// production && livereload(distDir),
	],
	watch: {
		clearScreen: false,
		buildDelay: 100,
	},
}
