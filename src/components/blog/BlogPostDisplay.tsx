'use client';

import React, { useState, useEffect } from 'react';
import { BlogPostContent } from './BlogPostComponents';import { Loader2, AlertCircle } from 'lucide-react';
import { BlogPostRenderer } from './BlogPostComponents';
/**
 * BlogPostDisplay Component
 * Perfectly integrated with QuickOptimizeButton
 * Renders blog posts with all SOTA HTML components
 */

export interface BlogPostDisplayProps {
  postId?: string;
  post?: BlogPostContent;
  isLoading?: boolean;
  error?: string;
}

export function BlogPostDisplay({ postId, post, isLoading, error }: BlogPostDisplayProps) {
  const [displayPost, setDisplayPost] = useState<BlogPostContent | null>(post || null);
  const [displayLoading, setDisplayLoading] = useState(isLoading || false);
  const [displayError, setDisplayError] = useState(error || null);

  useEffect(() => {
    setDisplayPost(post || null);
    setDisplayLoading(isLoading || false);
    setDisplayError(error || null);
  }, [post, isLoading, error]);

  // Loading state
  if (displayLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Rendering your optimized blog post...</p>
          <p className="text-sm text-gray-500 mt-1">This won't take long</p>
        </div>
      </div>
    );
  }

  // Error state
  if (displayError) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">Error Loading Blog Post</h3>
            <p className="text-sm text-red-800">{displayError}</p>
          </div>
        </div>
      </div>
    );
  }

  // No post
  if (!displayPost) {
    return (
      <div className="p-6 bg-gray-50 border-2 border-gray-200 rounded-lg text-center">
        <p className="text-gray-700">No blog post to display. Click "Optimize" to generate one!</p>
      </div>
    );
  }

  // Render blog post with all components
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <BlogPostRenderer post={displayPost} />
    </div>
  );
}

export default BlogPostDisplay;
