'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { BlogPostRenderer, BlogPostContent } from './BlogPostComponents';

/**
 * ERROR BOUNDARY - Catches rendering crashes
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class BlogErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BlogErrorBoundary] Caught error:', error);
    console.error('[BlogErrorBoundary] Error info:', errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Rendering Error</h3>
              <p className="text-sm text-red-800 mb-3">
                Failed to display the blog post. The content may have an unexpected format.
              </p>
              <p className="text-xs text-red-600 font-mono mb-3">
                {this.state.error?.message || 'Unknown error'}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Validates and normalizes blog post data
 */
function validateAndNormalizeBlogPost(post: any): BlogPostContent | null {
  if (!post || typeof post !== 'object') {
    console.error('[validateBlogPost] Invalid post: not an object', post);
    return null;
  }

  // Ensure required fields exist
  const normalized: BlogPostContent = {
    title: post.title || post.optimizedTitle || 'Untitled Post',
    author: post.author || 'Content Expert',
    publishedAt: post.publishedAt || new Date().toISOString(),
    excerpt: post.excerpt || post.metaDescription || '',
    sections: [],
  };

  // Validate and normalize sections
  if (Array.isArray(post.sections)) {
    normalized.sections = post.sections.map((section: any, index: number) => {
      if (!section || typeof section !== 'object') {
        console.warn(`[validateBlogPost] Section ${index} is invalid, skipping`);
        return null;
      }

      const normalizedSection: any = {
        type: section.type || 'paragraph',
        content: section.content || '',
      };

      // Handle different section types
      switch (section.type) {
        case 'takeaways':
          normalizedSection.data = Array.isArray(section.data) ? section.data : [];
          break;
        case 'quote':
          normalizedSection.data = {
            text: section.data?.text || section.text || '',
            author: section.data?.author || section.author || '',
            source: section.data?.source || section.source || '',
          };
          break;
        case 'cta':
          normalizedSection.data = {
            title: section.data?.title || section.title || 'Take Action',
            description: section.data?.description || section.description || '',
            buttonText: section.data?.buttonText || section.buttonText || 'Get Started',
            buttonLink: section.data?.buttonLink || section.buttonLink || '#',
          };
          break;
        case 'video':
          normalizedSection.data = {
            videoId: section.data?.videoId || section.videoId || '',
            title: section.data?.title || section.title || 'Video',
          };
          break;
        case 'table':
          normalizedSection.data = {
            headers: Array.isArray(section.data?.headers) ? section.data.headers : [],
            rows: Array.isArray(section.data?.rows) ? section.data.rows : [],
            title: section.data?.title || section.title || '',
          };
          break;
        case 'patent':
          normalizedSection.data = Array.isArray(section.data) ? section.data : [];
          break;
        case 'chart':
          normalizedSection.data = {
            title: section.data?.title || section.title || 'Chart',
            description: section.data?.description || section.description || '',
          };
          break;
        default:
          // For heading, paragraph, tldr, summary - just use content
          normalizedSection.content = section.content || '';
          break;
      }

      return normalizedSection;
    }).filter(Boolean);
  } else {
    console.warn('[validateBlogPost] No sections array, creating default');
    normalized.sections = [
      {
        type: 'paragraph',
        content: post.optimizedContent || post.content || 'No content available.',
      },
    ];
  }

  console.log('[validateBlogPost] Normalized post:', normalized);
  return normalized;
}

/**
 * BlogPostDisplay Component
 */
export interface BlogPostDisplayProps {
  postId?: string;
  post?: any; // Accept any shape, we'll validate it
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function BlogPostDisplay({ postId, post, isLoading, error, onRetry }: BlogPostDisplayProps) {
  const [displayPost, setDisplayPost] = useState<BlogPostContent | null>(null);
  const [displayLoading, setDisplayLoading] = useState(isLoading || false);
  const [displayError, setDisplayError] = useState<string | null>(error || null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[BlogPostDisplay] Received post:', post);
    
    setDisplayLoading(isLoading || false);
    setDisplayError(error || null);
    setValidationError(null);

    if (post) {
      const validated = validateAndNormalizeBlogPost(post);
      if (validated) {
        setDisplayPost(validated);
        console.log('[BlogPostDisplay] Post validated successfully');
      } else {
        setValidationError('Failed to parse blog post data');
        setDisplayPost(null);
        console.error('[BlogPostDisplay] Post validation failed');
      }
    } else {
      setDisplayPost(null);
    }
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
  if (displayError || validationError) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">Error Loading Blog Post</h3>
            <p className="text-sm text-red-800 mb-3">{displayError || validationError}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}
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

  // Render blog post with error boundary
  return (
    <BlogErrorBoundary
      onError={(err) => console.error('[BlogPostDisplay] Render error:', err)}
    >
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <BlogPostRenderer post={displayPost} />
      </div>
    </BlogErrorBoundary>
  );
}

export default BlogPostDisplay;
