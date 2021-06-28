const { resolve } = require('path')

// module.exports = {
// 	name: 'Default',
// 	condition: () => true,
// 	config: ({ pkgjson }) => {
// 		// set some healthy defaults
// 		const defaults = {
// 			assets: 'assets',
// 			dist: 'dist',
// 			script: 'dist/build/main.js',
// 			template: 'dist/__app.html',
// 		}

// 		// merge with the app field from package.json, if it exists
// 		const config = { ...defaults, ...pkgjson.options }

// 		return {
// 			// prioritize 'dist' over 'assets', in case asset has been transformed
// 			assetsDir: [config.dist, config.assets],
// 			script: config.script,
// 			entrypoint: config.template,
// 			ssrOptions: {
// 				inlineDynamicImports: true,
// 			},
// 		}
// 	},
// }

module.exports = {
	assetsDir: 'assets',
	dist: 'dist',
	entrypoint: resolve('dist/index.html'),
	// entrypoint: 'dist/index.html',
	// entrypoint: 'dist/__app.html',
	// script: 'dist/build/bundle.js',
	script: resolve('dist/build/main.js'),
	serveSpa: true,
	port: 5000,
	ssr: true,
	ssrOptions: {
		inlineDynamicImports: true,
		timeout: 1000,
	},
	// middleware: (server) => {

	// 	server.use((req, res, next) => {
	// 	// server.use((req, res, next) => {
	// 		// console.log(req)
	// 		// console.log('Time: %d', Date.now())
	// 		// console.log(res)
	// 		// res.set({
	// 		// 	'Cross-Origin-Opener-Policy': 'same-origin',
	// 		// 	'Cross-Origin-Embedder-Policy': 'require-corp',
	// 		// })
	// 		// console.log('Time: %d', Date.now())
	// 		// console.log(res)
	// 		// res.sendFile(resolve('dist/index.html'))
	// 		next();
	// 		// res.end('ok');
	// 		// next(resolve('dist/__app.html'))
	// 	})

		// server.get('/', (req, res, next) => {
		// // server.use((req, res, next) => {
		// 	// console.log(req)
		// 	console.log('Time: %d', Date.now())
		// 	console.log(res)
		// 	res.set({
		// 		'Cross-Origin-Opener-Policy': 'same-origin',
		// 		'Cross-Origin-Embedder-Policy': 'require-corp',
		// 	})
		// 	// console.log('Time: %d', Date.now())
		// 	// console.log(res)
		// 	// res.sendFile(resolve('dist/index.html'))
		// 	res.end('ok');
		// 	// next(resolve('dist/__app.html'))
		// })

	// },
}
