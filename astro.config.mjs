import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    integrations: [react(), sitemap({ entryLimit: 10000 })],
    site: 'https://ham.srinikb.in',
    output: 'static',
});