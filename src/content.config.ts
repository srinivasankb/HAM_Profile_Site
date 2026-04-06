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

const resources = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/resources" }),
    schema: z.object({
        unlisted: z.boolean().default(false),
        title: z.string(),
        description: z.string(),
        url: z.string().optional(),
        category: z.enum(['operating', 'technical', 'software', 'learning', 'tools']),
        icon: z.string().optional(),
        pinned: z.boolean().default(false),
    }),
});

export const collections = {
    'blogs': blogs,
    'resources': resources,
};
