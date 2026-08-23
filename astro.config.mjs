import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import sitemap from '@astrojs/sitemap';
import { rehypeWrapTables } from './src/lib/rehype-wrap-tables.mjs';

// https://astro.build/config
export default defineConfig({
    integrations: [react(), sitemap({ 
        entryLimit: 10000,
        filter: (page) => !page.includes('/net')
    })],
    site: 'https://ham.srinikb.in',
    output: 'static',
    markdown: {
        rehypePlugins: [rehypeWrapTables],
    },
});