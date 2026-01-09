'use client';

import React from 'react';
import Link from 'next/link';
import {
  KeyTakeawaysBox,
  QuoteBox,
  StatsBox,
  CTABox,
  ProTipBox,
  WarningBox,
  ComparisonBox,
  StepsBox,
  HighlightBox,
} from './BlogBoxComponents';
import styles from './blog-boxes.module.css';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: React.ReactNode;
  author: string;
  publishedAt: Date;
  readTime: string;
  category: string;
  tags: string[];
}

interface BlogPostRendererProps {
  post: BlogPost;
}

export const BlogPostRenderer: React.FC<BlogPostRendererProps> = ({ post }) => {
  return (
    <article style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      {/* BEAUTIFUL HEADER SECTION */}
      <header style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '32px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '6px 12px',
              backgroundColor: '#dbeafe',
              color: '#0c4a6e',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {post.category}
          </span>
          <span
            style={{
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
              borderRadius: '20px',
              fontSize: '12px',
            }}
          >
            {post.readTime}
          </span>
        </div>

        <h1
          style={{
            fontSize: '48px',
            fontWeight: '900',
            color: '#111827',
            margin: '24px 0',
            lineHeight: '1.2',
          }}
        >
          {post.title}
        </h1>

        <p
          style={{
            fontSize: '20px',
            color: '#6b7280',
            margin: '20px 0',
            lineHeight: '1.6',
          }}
        >
          {post.excerpt}
        </p>

        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', marginTop: '20px' }}>
          <div>
            <p style={{ margin: '0', fontWeight: '600', color: '#111827' }}>{post.author}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WITH BEAUTIFUL BOXES */}
      <div style={{ lineHeight: '1.8', color: '#374151', fontSize: '16px' }}>
        {post.content}
      </div>

      {/* FOOTER WITH TAGS */}
      <footer
        style={{
          borderTop: '2px solid #e5e7eb',
          paddingTop: '32px',
          marginTop: '60px',
        }}
      >
        {post.tags && post.tags.length > 0 && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Tags
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tags/${encodeURIComponent(tag)}`}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#d1d5db';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </footer>
    </article>
  );
};

export default BlogPostRenderer;
export {
  KeyTakeawaysBox,
  QuoteBox,
  StatsBox,
  CTABox,
  ProTipBox,
  WarningBox,
  ComparisonBox,
  StepsBox,
  HighlightBox,
};
