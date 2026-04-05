import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogs = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/blogs" }),
    schema: z.object({
        unlisted: z.boolean().default(false),
        title: z.string(),
        date: z.coerce.date(),
        author: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        image: z.string().optional(),
    }),
});

export const collections = {
    'blogs': blogs,
};
