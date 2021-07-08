module.exports = {
	name: 'Default',
	condition: () => true,
	config: ({ pkgjson }) => {
		// set some healthy defaults
		const defaults = {
			assets: 'assets',
			dist: 'dist',
			script: 'dist/build/main.js',
			template: 'assets/__app.html',
		}

		// merge with the app field from package.json, if it exists
		const config = { ...defaults, ...pkgjson.options }

		return {
			// prioritize 'dist' over 'assets', in case asset has been transformed
			assetsDir: [config.dist, config.assets],
			script: config.script,
			entrypoint: config.template,
			ssrOptions: {
				inlineDynamicImports: true,
			},
		}
	},
}
