import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const blogs = await getCollection('blogs');
    return rss({
        title: 'VU35KB Radio Journal',
        description: 'Latest updates, technical guides, and stories from VU35KB.',
        site: context.site || 'https://vu35kb.qrz.com',
        items: blogs.filter(post => !post.data.unlist).map((post) => ({
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.description,
            author: post.data.author,
            link: `/blog/${post.id}/`,
        })),
        customData: `<language>en-us</language>`,
    });
}
