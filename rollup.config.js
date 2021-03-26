import { createRollupConfigs } from './scripts/base.config.js'
import autoPreprocess from 'svelte-preprocess'
import postcssImport from 'postcss-import'
const production = !process.env.ROLLUP_WATCH;



export const config = {
  staticDir: 'static',
  distDir: 'dist',
  buildDir: `dist/build`,
  serve: !production,
  production,
  rollupWrapper: cfg => cfg,
  svelteWrapper: svelte => {
    svelte.preprocess = [
			autoPreprocess({
				postcss: {
					plugins: [
						postcssImport({	}),
					],
				},
				defaults: { style: 'postcss' },
			}),
		]
  },
  swWrapper: cfg => cfg,
}

const configs = createRollupConfigs(config)

export default configs