// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	markdown: {
		syntaxHighlight: 'shiki',
		shikiConfig: {
			theme: 'dark-plus' // monokai, dark-plus or default
		}
	},
	site: 'https://gamewin221.github.io',
	integrations: [mdx(), sitemap()],
});
