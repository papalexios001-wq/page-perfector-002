'use client';

import React from 'react';
import Link from 'next/link';
import { ReactMarkdown } from 'react-markdown';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
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
    <article className="max-w-4xl mx-auto px-4 py-12 font-sans">
      {/* Header Section */}
      <header className="mb-12 border-b-2 border-gray-200 pb-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {post.category}
          </span>
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
            {post.readTime} read
          </span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          {post.title}
        </h1>
        
        <p className="text-xl text-gray-600 mb-6">{post.excerpt}</p>
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-gray-600">
            <p className="font-semibold">{post.author}</p>
            <p className="text-sm">{new Date(post.publishedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      {/* Content Section with Beautiful Boxes */}
      <div className="prose prose-lg max-w-none mb-12">
        <ContentWithBoxes content={post.content} />
      </div>

      {/* Tags Section */}
      <footer className="border-t-2 border-gray-200 pt-8">
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tags/${encodeURIComponent(tag)}`}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </article>
  );
};

// Component to render content with beautiful boxes
const ContentWithBoxes: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Key Takeaways Box
    if (line.includes('Key Takeaways') || line.includes('KEY TAKEAWAYS')) {
      i++;
      const takeaways: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('✓') || lines[i].trim().startsWith('•'))) {
        takeaways.push(lines[i].trim());
        i++;
      }
      elements.push(
        <KeyTakeawaysBox key={`takeaways-${elements.length}`} takeaways={takeaways} />
      );
      continue;
    }

    // Quote Box
    if (line.includes('\"') && (line.includes('said') || line.includes('quote'))) {
      elements.push(
        <QuoteBox key={`quote-${elements.length}`} content={line} />
      );
      i++;
      continue;
    }

    // Regular Markdown
    if (line.trim().length > 0) {
      elements.push(
        <div key={`content-${elements.length}`} className="mb-6">
          <p className="text-gray-800 leading-relaxed">{line}</p>
        </div>
      );
    }

    i++;
  }

  return <div>{elements}</div>;
};

// Beautiful Key Takeaways Box
const KeyTakeawaysBox: React.FC<{ takeaways: string[] }> = ({ takeaways }) => (
  <div className="my-8 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg shadow-md">
    <h3 className="text-2xl font-bold text-blue-900 mb-6 flex items-center">
      <span className="mr-3 text-3xl">📌</span> Key Takeaways
    </h3>
    <ul className="space-y-3">
      {takeaways.map((takeaway, idx) => (
        <li key={idx} className="text-gray-800 flex items-start">
          <span className="text-blue-600 font-bold mr-3 mt-1">✓</span>
          <span>{takeaway.replace(/^[✓•]\s*/, '').trim()}</span>
        </li>
      ))}
    </ul>
  </div>
);

// Beautiful Quote Box
const QuoteBox: React.FC<{ content: string }> = ({ content }) => (
  <div className="my-8 p-8 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600 rounded-lg shadow-md italic">
    <p className="text-lg text-gray-800 leading-relaxed flex items-start">
      <span className="text-4xl text-amber-600 mr-4 leading-none">\"</span>
      <span>{content}</span>
    </p>
  </div>
);

// CTA Box
export const CTABox: React.FC<{ title: string; description: string; ctaText: string; ctaHref: string }> = ({
  title,
  description,
  ctaText,
  ctaHref,
}) => (
  <div className="my-12 p-10 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-600 rounded-xl shadow-lg text-center">
    <h3 className="text-3xl font-bold text-green-900 mb-4">{title}</h3>
    <p className="text-lg text-gray-700 mb-8">{description}</p>
    <Link
      href={ctaHref}
      className="inline-block px-8 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md"
    >
      {ctaText}
    </Link>
  </div>
);

export default BlogPostRenderer;
