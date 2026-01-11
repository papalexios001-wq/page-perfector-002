'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { BlogPostRenderer, BlogPostContent } from ../BlogPostComponents';

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
 * ENTERPRISE-GRADE: Validates and normalizes blog post data with comprehensive fallbacks
 */
function validateAndNormalizeBlogPost(post: any): BlogPostContent | null {
  console.log('[validateBlogPost] Input post:', JSON.stringify(post, null, 2));
  
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
  if (Array.isArray(post.sections) && post.sections.length > 0) {
    console.log(`[validateBlogPost] Processing ${post.sections.length} sections`);
    
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
          if (normalizedSection.data.length === 0) {
            console.warn(`[validateBlogPost] Takeaways section ${index} has no data`);
          }
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
          // For heading, paragraph, tldr, summary - just use content
          normalizedSection.content = section.content || '';
          break;
      }

      return normalizedSection;
    }).filter(Boolean);
  } else {
    console.warn('[validateBlogPost] No sections found, creating default section');
    normalized.sections = [{
      type: 'paragraph',
      content: post.content || post.optimizedContent || 'No content available.'
    }];
  }

  console.log('[validateBlogPost] Normalized post:', JSON.stringify(normalized, null, 2));
  return normalized;
}

/**
 * SOTA ENTERPRISE-GRADE: Main BlogPost Display Component
 */
interface BlogPostDisplayProps {
  post: any;
  onOptimizeSuccess?: (optimizedPost: any) => void;
}

export default function BlogPostDisplay({ post, onOptimizeSuccess }: BlogPostDisplayProps) {
  const [normalizedPost, setNormalizedPost] = useState<BlogPostContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[BlogPostDisplay] Post prop changed:', post);
    
    if (!post) {
      console.error('[BlogPostDisplay] No post provided');
      setError('No blog post data provided');
      setIsProcessing(false);
      return;
    }

    // Validate and normalize the post
    const validated = validateAndNormalizeBlogPost(post);
    
    if (!validated) {
      console.error('[BlogPostDisplay] Post validation failed');
      setError('Failed to validate blog post data');
      setIsProcessing(false);
      return;
    }

    console.log('[BlogPostDisplay] Post validated successfully');
    setNormalizedPost(validated);
    setError(null);
    setIsProcessing(false);
  }, [post]);

  // Loading state
  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Processing blog post...</p>
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
