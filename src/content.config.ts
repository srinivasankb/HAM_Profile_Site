import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogs = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/blogs" }),
    schema: z.object({
        title: z.string(),
        date: z.coerce.date(), // Using z.coerce.date() is cleaner in Astro 6
        author: z.string().default('Srinivasan KB'),
        description: z.string(),
        tags: z.array(z.string()).default([]),
        image: z.string().default('/avatar.png'),
    }),
});

export const collections = {
    'blogs': blogs,
};
