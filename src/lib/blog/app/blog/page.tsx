'use client';

import React from 'react';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog/blog-posts';
import BlogPostRenderer from '@/lib/blog/BlogPostRenderer';

export default function BlogPage() {
  const post = BLOG_POSTS[0]; // Get the first blog post

  return (
    <>
      {/* Header Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
            Page Perfector
          </Link>
          <div className="flex gap-6 items-center">
            <Link href="/blog" className="text-gray-700 hover:text-gray-900 font-medium">
              Blog
            </Link>
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Back to App
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Blog Post */}
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <BlogPostRenderer post={post} />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="mb-4">
            Love this content? Follow Page Perfector for more SEO optimization tips and strategies.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            <Link href="/" className="hover:text-blue-400 transition-colors">
              Learn More
            </Link>
            <Link href="/" className="hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            <Link href="/" className="hover:text-blue-400 transition-colors">
              Contact Us
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-8">
            © 2025 Page Perfector. All rights reserved. | SEO/GEO/AEO Optimization Platform
          </p>
        </div>
      </footer>
    </>
  );
}
