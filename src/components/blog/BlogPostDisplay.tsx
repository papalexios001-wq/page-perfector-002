'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Database, Clock } from 'lucide-react';
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
  console.log('[validateBlogPost] Input pageData:', JSON.stringify(pageData, null, 2).substring(0, 1000));
  
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

  console.log('[validateBlogPost] Normalized post with', normalized.sections.length, 'sections');
  return normalized;
}

/**
 * ENTERPRISE-GRADE: Read page data directly from localStorage
 * This is a fallback mechanism when Zustand store hasn't hydrated yet
 */
function getPageFromLocalStorage(slug: string): any {
  try {
    const storedData = localStorage.getItem('wp-optimizer-pages');
    if (!storedData) {
      console.log('[getPageFromLocalStorage] No data in localStorage');
      return null;
    }
    
    const parsed = JSON.parse(storedData);
    const pages = parsed?.state?.pages || [];
    const page = pages.find((p: any) => p.slug === slug);
    
    if (page) {
      console.log('[getPageFromLocalStorage] Found page in localStorage:', page.slug);
      return page;
    }
    
    console.log('[getPageFromLocalStorage] Page not found in localStorage for slug:', slug);
    return null;
  } catch (e) {
    console.error('[getPageFromLocalStorage] Error reading localStorage:', e);
    return null;
  }
}

/**
 * SOTA ENTERPRISE-GRADE: Main BlogPost Display Component
 * Accepts slug, fetches page data from store (with localStorage fallback), validates and renders
 */
interface BlogPostDisplayProps {
  slug: string;
}

export default function BlogPostDisplay({ slug }: BlogPostDisplayProps) {
  const [normalizedPost, setNormalizedPost] = useState<BlogPostContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // Get pages from Zustand store
  const pages = usePagesStore((state) => state.pages);

  // Memoized function to find and validate page data
  const findAndValidatePage = useCallback(() => {
    console.log('[BlogPostDisplay] ====================================');
    console.log('[BlogPostDisplay] findAndValidatePage called');
    console.log('[BlogPostDisplay] Slug:', slug);
    console.log('[BlogPostDisplay] Pages in store:', pages.length);
    console.log('[BlogPostDisplay] Retry count:', retryCount);
    
    if (!slug) {
      console.error('[BlogPostDisplay] No slug provided');
      setError('No blog post identifier provided');
      setDebugInfo('Slug is empty or undefined');
      setIsProcessing(false);
      return;
    }

    // Try to find page in Zustand store first
    let pageData = pages.find(p => p.slug === slug);
    let source = 'zustand';
    
    // If not found in store, try localStorage fallback
    if (!pageData) {
      console.log('[BlogPostDisplay] Page not in Zustand store, trying localStorage fallback');
      pageData = getPageFromLocalStorage(slug);
      source = 'localStorage';
    }
    
    if (!pageData) {
      console.error('[BlogPostDisplay] Page not found anywhere for slug:', slug);
      
      // If we haven't retried much, wait and retry
      if (retryCount < 5) {
        console.log('[BlogPostDisplay] Will retry in 500ms (attempt', retryCount + 1, 'of 5)');
        setDebugInfo(`Looking for page... (attempt ${retryCount + 1}/5)`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 500);
        return;
      }
      
      // After retries exhausted, show error
      setError(`Blog post not found: "${slug}". The optimization may not have completed.`);
      setDebugInfo(`Searched in Zustand store (${pages.length} pages) and localStorage. Slug: "${slug}"`);
      setIsProcessing(false);
      return;
    }

    console.log('[BlogPostDisplay] Found page data from', source, ':', pageData.slug);
    console.log('[BlogPostDisplay] Page status:', pageData.status);
    console.log('[BlogPostDisplay] Has optimizedAt:', !!pageData.optimizedAt);
    console.log('[BlogPostDisplay] Has optimizedContent:', !!pageData.optimizedContent);

    // Check if page has been optimized
    if (!pageData.optimizedAt && !pageData.optimizedContent) {
      console.warn('[BlogPostDisplay] Page not optimized yet');
      
      // Retry a few times in case optimization just finished
      if (retryCount < 5) {
        console.log('[BlogPostDisplay] Waiting for optimization... (attempt', retryCount + 1, 'of 5)');
        setDebugInfo(`Waiting for optimization to complete... (attempt ${retryCount + 1}/5)`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 500);
        return;
      }
      
      setError('This blog post has not been optimized yet. Please wait for the optimization to complete.');
      setDebugInfo(`Page found but not optimized. Status: ${pageData.status}`);
      setIsProcessing(false);
      return;
    }

    // Validate and normalize the page data
    const validated = validateAndNormalizeBlogPost(pageData);
    
    if (!validated) {
      console.error('[BlogPostDisplay] Page validation failed');
      setError('Failed to validate blog post data. The content format may be invalid.');
      setDebugInfo(`Validation failed. optimizedContent type: ${typeof pageData.optimizedContent}`);
      setIsProcessing(false);
      return;
    }

    console.log('[BlogPostDisplay] Page validated successfully with', validated.sections.length, 'sections');
    setNormalizedPost(validated);
    setError(null);
    setDebugInfo('');
    setIsProcessing(false);
  }, [slug, pages, retryCount]);

  // Run find and validate when dependencies change
  useEffect(() => {
    findAndValidatePage();
  }, [findAndValidatePage]);

  // Loading state with status info
  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Loading blog post...</p>
          {debugInfo && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {debugInfo}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Error state with debug information
  if (error || !normalizedPost) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-900 mb-2">Display Error</h3>
              <p className="text-sm text-red-800 mb-4">
                {error || 'Unable to display blog post'}
              </p>
              
              {/* Debug info for troubleshooting */}
              <details className="mb-4">
                <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                  Debug Information
                </summary>
                <div className="mt-2 p-3 bg-red-100 rounded text-xs font-mono text-red-700">
                  <p><strong>Slug:</strong> {slug}</p>
                  <p><strong>Pages in store:</strong> {pages.length}</p>
                  <p><strong>Retry attempts:</strong> {retryCount}</p>
                  {debugInfo && <p><strong>Details:</strong> {debugInfo}</p>}
                  <p className="mt-2"><strong>Available slugs:</strong></p>
                  <ul className="ml-4">
                    {pages.slice(0, 5).map((p, i) => (
                      <li key={i}>• {p.slug} ({p.status})</li>
                    ))}
                    {pages.length > 5 && <li>...and {pages.length - 5} more</li>}
                  </ul>
                </div>
              </details>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRetryCount(0);
                    setIsProcessing(true);
                    setError(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Go to Dashboard
                </button>
              </div>
            </div>
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
