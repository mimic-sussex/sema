module.exports = {
	assetsDir: [],
	entrypoint: resolve(__dirname, 'dist/index.html'),
	script: resolve(__dirname, 'dist/main.js'),
	port: 5000,
	ssr: true,
	ssrOptions: {
		inlineDynamicImports: true,
		timeout: 1000,
	},
	middleware: (server) => {
		server.get('/', (req, res) => {
			console.log('hello cross-isolation')
			res.set({
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'require-corp',
			})
		})
	},
}
