import svelte from 'rollup-plugin-svelte-hot';
import { join } from 'path';
import Hmr from 'rollup-plugin-hot'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';
import url from '@rollup/plugin-url';
import del from 'del';
import replace from '@rollup/plugin-replace';
import { spassr } from 'spassr'
import { string } from "rollup-plugin-string";
import { wasm } from '@rollup/plugin-wasm'
import workerLoader from 'rollup-plugin-web-worker-loader'
import sourcemaps from 'rollup-plugin-sourcemaps'
// import { plugin as globImport } from 'rollup-plugin-glob-import'; doesn't work with dynamic imports
import dynamicImportVariables from 'rollup-plugin-dynamic-import-variables'


const isNollup = !!process.env.NOLLUP

export function createRollupConfigs(config) {
    const { production, serve, distDir } = config
    const useDynamicImports = process.env.BUNDLING === 'dynamic' || isNollup || !!production

    del.sync(distDir + '/**') // clear previous builds

    if (serve && !isNollup)
        spassr({
            serveSpa: true, // serve app
            serveSsr: !isNollup, // Nollup doesn't need SSR
            silent: isNollup // Nollup needs Spassr internally
        })

    // Combine configs as needed
    return [
        !isNollup && baseConfig(config, { dynamicImports: false }),
        useDynamicImports && baseConfig(config, { dynamicImports: true }),
        !isNollup && serviceWorkerConfig(config)
    ].filter(Boolean)
}

// Silence warning
const onwarn = (warning, warn) =>  {
	// suppress eval warnings
	if (warning.code === 'EVAL') return
	warn(warning)
}


/**
 * Base config extended by dynamicConfig and baseConfig
 */
function baseConfig(config, ctx) {
    const { dynamicImports } = ctx
    const { staticDir, distDir, production, buildDir, svelteWrapper, rollupWrapper } = config

    const outputConfig = !!dynamicImports
        ? { format: 'esm', dir: buildDir }
        : { format: 'iife', file: `${buildDir}/bundle.js` }

    const _svelteConfig = {
			dev: !production, // run-time checks
			// Extract component CSS — better performance

			// emitCss: true,
			css: (css) => css.write(`${buildDir}/bundle.css`),
			hot: isNollup,
		}

    const svelteConfig = svelteWrapper(_svelteConfig, ctx) || _svelteConfig

    const _rollupConfig = {
			inlineDynamicImports: !dynamicImports,
			preserveEntrySignatures: false,
			onwarn,
			input: `src/main.js`,
			output: {
				name: 'routify_app',
				sourcemap: true,
				...outputConfig,
			},
			plugins: [
				copy({
					targets: [
						{
							// ! NOTE `!${staticDir}/samples` a negated pattern for the static/assets directory,
							// ! we want to prevent static/samples from being copied
							// ! and have them emitted (not inlined) by the plugin-URL
							src: [
								`${staticDir}/*`,
								'!*/(__index.html)',
								`!${staticDir}/samples`,
							],
							dest: distDir,
						},
						{
							src: [`${staticDir}/__index.html`],
							dest: distDir,
							rename: '__app.html',
							// rename: 'index.html',
							transform,
						},
						{
							src: [
								'node_modules/sema-engine/maxi-processor.js',
								'node_modules/sema-engine/sema-engine.wasmmodule.js',
								'node_modules/sema-engine/open303.wasmmodule.js',
								'node_modules/sema-engine/ringbuf.js',
								'node_modules/sema-engine/transducers.js',
								'node_modules/sema-engine/lalolib.js',
								'node_modules/sema-engine/svd.js',
							],
							// dest: `${buildDir}`,
							dest: distDir,
						},
					],
					copyOnce: true,
					flatten: false,
					verbose: true,
				}),
				svelte(svelteConfig),

				// resolve matching modules from current working directory
				resolve({
					browser: true,
					dedupe: (importee) => !!importee.match(/svelte(\/|$)/),
				}),
				commonjs(),
				dynamicImportVariables({
					exclude: [
						'static/languages/**/grammar.ne',
						'static/languages/**/code.sem',
						'static/learners/**/*.tf',
					], // options
					include: ['**/*.wav'],
					warnOnError: true,
				}),
				// globImport(),
				url({
					include: ['**/*.wav'],
					// publicPath: 'samples',
					limit: 10, // 10 kb
					// // publicPath: '/batman/',
					emitFiles: true,
					fileName: '[name][extname]', // '[name][extname]' 'dist/build/'
					// sourceDir: join(__dirname, 'src/samples'), // 'dist/static/samples'
					sourceDir: __dirname, // 'dist/build/static/samples'
					// sourceDir: join(__dirname, 'src/samples'), // 'dist/static/samples'
					destDir: join(__dirname, 'dist/sema-engine/samples'), // 'dist/static/samples'
					// destDir: join(__dirname, `${distDir}/sema-engine/samples`), // 'dist/static/samples'
					// destDir: __dirname,
				}),
				string({
					include: [
						'static/languages/**/grammar.ne',
						'static/languages/**/code.sem',
						'static/learners/**/*.tf',
					],
				}),
				workerLoader(),
				wasm(),
				sourcemaps(),
				production && terser(), // minify
				!production && isNollup && Hmr({ inMemory: true, public: staticDir }), // refresh only updated code
				!production && !isNollup && livereload(distDir), // refresh entire window when code is updated
			],
			watch: {
				clearScreen: false,
				buildDelay: 100,
			},
		}

    const rollupConfig = rollupWrapper(_rollupConfig, ctx) || _rollupConfig

    return rollupConfig

    function transform(contents) {
        const scriptTag = typeof config.scriptTag != 'undefined' ?
            config.scriptTag : '<script type="module" defer src="/build/main.js"></script>'
        const bundleTag = '<script defer src="/build/bundle.js"></script>'
        return contents.toString().replace('__SCRIPT__', dynamicImports ? scriptTag : bundleTag)
    }
}


/**
 * Can be deleted if service workers aren't used
 */
function serviceWorkerConfig(config) {
    const { distDir, production, swWrapper } = config
    const _rollupConfig = {
        input: `src/sw.js`,
        output: {
            name: 'service_worker',
            sourcemap: true,
            format: 'iife',
            file: `${distDir}/sw.js`
        },
        plugins: [
            commonjs(),
            resolve({ browser: true }),
            production && terser(),
            replace({ 'process.env.NODE_ENV': "'production'" })
        ]
    }
    const rollupConfig = swWrapper(_rollupConfig, {}) || _rollupConfig

    return rollupConfig
}