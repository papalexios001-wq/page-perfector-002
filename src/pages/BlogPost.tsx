// ============================================================================
// ENTERPRISE-GRADE BLOG POST PAGE
// With Global Error Boundary to prevent blank screens
// ============================================================================
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, RefreshCw, Home } from 'lucide-react';
import BlogPostDisplay from '../components/blog/BlogPostDisplay';

// ============================================================================
// GLOBAL ERROR BOUNDARY - Catches ANY React crash
// ============================================================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<{ children: ReactNode; onGoHome: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onGoHome: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Error info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-600 mb-4">
                The blog post could not be displayed. This might be due to missing or invalid data.
              </p>
              
              {/* Error details for debugging */}
              <details className="text-left mb-6 p-4 bg-red-50 rounded-lg">
                <summary className="cursor-pointer text-red-700 font-medium">Error Details</summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                  {this.state.error?.message || 'Unknown error'}
                  {'\n\n'}
                  {this.state.error?.stack || ''}
                </pre>
              </details>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.props.onGoHome}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// MAIN BLOG POST PAGE COMPONENT
// ============================================================================
export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  console.log('[BlogPost] ====================================');
  console.log('[BlogPost] Page mounted with slug:', slug);
  console.log('[BlogPost] Current URL:', window.location.href);
  console.log('[BlogPost] ====================================');

  const handleGoHome = () => {
    navigate('/');
  };

  // Handle missing slug
  if (!slug) {
    console.error('[BlogPost] No slug provided!');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-6">No blog post identifier was provided.</p>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <GlobalErrorBoundary onGoHome={handleGoHome}>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={handleGoHome}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="text-sm text-gray-500">
              Viewing: <code className="bg-gray-100 px-2 py-1 rounded">{slug}</code>
            </div>
          </div>
        </header>

        {/* Blog Post Content */}
        <main className="py-8">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">Loading blog post...</p>
                </div>
              </div>
            }
          >
            <BlogPostDisplay slug={slug} />
          </React.Suspense>
        </main>
      </div>
    </GlobalErrorBoundary>
  );
}
