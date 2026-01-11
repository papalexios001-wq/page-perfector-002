'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { BlogPostRenderer, BlogPostContent } from './BlogPostComponents';
import { usePagesStore } from '../../stores/pages-store';

/**
 * ERROR BOUNDARY - Catches rendering crashes
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onerror?: (error: Error) => void;
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
    this.props.onerror?.(error);
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
 * ENTERPRISE-GRADE: Validates and normalizes blog post data
 */
function validateAndNormalizeBlogPost(pageData: any): BlogPostContent | null {
  console.log('[validateBlogPost] Input pageData:', JSON.stringify(pageData, null, 2));
  
  if (!pageData || typeof pageData !== 'object') {
    console.error('[validateBlogPost] Invalid pageData: not an object', pageData);
    return null;
  }

  // Extract optimized content - it might be in different locations
  const optimizedContent = pageData.optimizedContent || pageData.content || pageData.result;
  
  if (!optimizedContent) {
    console.error('[validateBlogPost] No optimized content found in pageData');
    return null;
  }

  // Parse if it's a string
  let blogPost = optimizedContent;
  if (typeof optimizedContent === 'string') {
    try {
      blogPost = JSON.parse(optimizedContent);
    } catch (e) {
      console.error('[validateBlogPost] Failed to parse optimizedContent as JSON:', e);
      return null;
    }
  }

  // Normalize the blog post structure
  const normalized: BlogPostContent = {
    title: blogPost.title || blogPost.optimizedTitle || pageData.title || 'Untitled Post',
    author: blogPost.author || 'Content Expert',
    publishedAt: blogPost.publishedAt || pageData.publishedAt || new Date().toISOString(),
    excerpt: blogPost.excerpt || blogPost.metaDescription || '',
    sections: [],
  };

  // Validate and normalize sections
  if (Array.isArray(blogPost.sections) && blogPost.sections.length > 0) {
    console.log(`[validateBlogPost] Processing ${blogPost.sections.length} sections`);
    
    normalized.sections = blogPost.sections.map((section: any, index: number) => {
      if (!section || typeof section !== 'object') {
        console.warn(`[validateBlogPost] Section ${index} is invalid, skipping`);
        return null;
      }

      const normalizedSection: any = {
        type: section.type || 'paragraph',
        content: section.content || '',
      };

      // Handle section-specific data
      switch (section.type) {
        case 'takeaways':
          normalizedSection.data = Array.isArray(section.data) ? section.data : [];
          break;
        case 'quote':
          normalizedSection.data = {
            text: section.data?.text || section.text || section.content || '',
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
          normalizedSection.content = section.content || '';
          break;
      }

      return normalizedSection;
    }).filter(Boolean);
  } else {
    console.warn('[validateBlogPost] No sections found, creating default section');
    normalized.sections = [{
      type: 'paragraph',
      content: blogPost.content || blogPost.optimizedContent || 'No content available.'
    }];
  }

  console.log('[validateBlogPost] Normalized post:', JSON.stringify(normalized, null, 2));
  return normalized;
}

/**
 * SOTA ENTERPRISE-GRADE: Main BlogPost Display Component
 * Accepts slug, fetches page data from store, validates and renders
 */
interface BlogPostDisplayProps {
  slug: string;
}

export default function BlogPostDisplay({ slug }: BlogPostDisplayProps) {
  const [normalizedPost, setNormalizedPost] = useState<BlogPostContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get pages from store
  const pages = usePagesStore((state) => state.pages);

  useEffect(() => {
    console.log('[BlogPostDisplay] Slug changed:', slug);
    console.log('[BlogPostDisplay] Available pages:', pages);
    
    if (!slug) {
      console.error('[BlogPostDisplay] No slug provided');
      setError('No blog post identifier provided');
      setIsProcessing(false);
      return;
    }

    // Find the page in the store by slug
    const pageData = pages.find(p => p.slug === slug);
    
    if (!pageData) {
      console.error('[BlogPostDisplay] Page not found in store for slug:', slug);
      setError(`Blog post not found: ${slug}`);
      setIsProcessing(false);
      return;
    }

    console.log('[BlogPostDisplay] Found page data:', pageData);

    // Check if page has been optimized
    if (!pageData.optimizedAt && !pageData.optimizedContent) {
      console.warn('[BlogPostDisplay] Page not optimized yet');
      setError('This blog post has not been optimized yet');
      setIsProcessing(false);
      return;
    }

    // Validate and normalize the page data
    const validated = validateAndNormalizeBlogPost(pageData);
    
    if (!validated) {
      console.error('[BlogPostDisplay] Page validation failed');
      setError('Failed to validate blog post data');
      setIsProcessing(false);
      return;
    }

    console.log('[BlogPostDisplay] Page validated successfully');
    setNormalizedPost(validated);
    setError(null);
    setIsProcessing(false);
  }, [slug, pages]);

  // Loading state
  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Loading blog post...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !normalizedPost) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">Display Error</h3>
            <p className="text-sm text-red-800">
              {error || 'Unable to display blog post'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render the blog post
  return (
    <BlogErrorBoundary>
      <div className="max-w-4xl mx-auto">
        <BlogPostRenderer post={normalizedPost} />
      </div>
    </BlogErrorBoundary>
  );
}
