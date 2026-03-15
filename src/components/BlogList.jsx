import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function BlogList({ blogs }) {
    const [search, setSearch] = useState("");

    const filteredBlogs = blogs.filter(b =>
        b.data.title.toLowerCase().includes(search.toLowerCase()) ||
        b.data.description.toLowerCase().includes(search.toLowerCase()) ||
        b.data.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="modern-container">
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 className="name-heading" style={{ textAlign: 'left', marginBottom: '0.5rem' }}>Radio Journal</h1>
                <p style={{ color: 'var(--muted-foreground)' }}>Documenting the amateur radio journey, one transmit at a time.</p>
            </header>

            <div className="search-wrapper" style={{ marginBottom: '2rem', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                <input
                    type="text"
                    placeholder="Search blogs..."
                    className="input-field"
                    style={{ paddingLeft: '3rem', width: '100%', maxWidth: '500px' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="blog-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {filteredBlogs.length > 0 ? filteredBlogs.map(blog => (
                    <a key={blog.id} href={`/blog/${blog.id}`} className="modern-card blog-card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="card-label">{new Date(blog.data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {blog.data.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
                            </div>
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{blog.data.title}</h2>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', lineHeight: '1.5' }}>{blog.data.description}</p>
                    </a>
                )) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                        No blogs found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
}
