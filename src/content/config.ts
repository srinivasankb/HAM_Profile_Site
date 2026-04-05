import { defineCollection, z } from 'astro:content';

const blogs = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        date: z.date(),
        author: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        image: z.string().optional(),
        unlist: z.boolean().optional().default(false),
    }),
});

export const collections = {
    'blogs': blogs,
};
