
import { getCollection } from 'astro:content';

const blogs = await getCollection('blogs');
console.log(JSON.stringify(blogs.map(b => ({ id: b.id, unlist: b.data.unlist })), null, 2));
