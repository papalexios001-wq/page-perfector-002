import { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BlogPost from "./pages/BlogPost";
import './styles/blog-components.css';

const queryClient = new QueryClient();

// ============================================================================
// GLOBAL ERROR BOUNDARY - PREVENTS BLANK SCREENS
// ============================================================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('[GlobalErrorBoundary] ====================================');
    console.error('[GlobalErrorBoundary] CRITICAL ERROR CAUGHT');
    console.error('[GlobalErrorBoundary] Error:', error);
    console.error('[GlobalErrorBoundary] Error message:', error.message);
    console.error('[GlobalErrorBoundary] Stack:', error.stack);
    console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[GlobalErrorBoundary] ====================================');
    
    this.setState({ errorInfo });

    // Also try to log to any error tracking service
    try {
      // Store error in localStorage for debugging
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('app-error-logs') || '[]');
      existingLogs.push(errorLog);
      // Keep only last 10 errors
      if (existingLogs.length > 10) existingLogs.shift();
      localStorage.setItem('app-error-logs', JSON.stringify(existingLogs));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  handleReset = () => {
    // Clear any potentially corrupted state
    try {
      // Clear specific localStorage items that might be causing issues
      localStorage.removeItem('wp-optimizer-pages');
    } catch (e) {
      // Ignore
    }
    
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Error Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold">Application Error</h1>
                  <p className="text-white/80 text-sm">Something went wrong</p>
                </div>
              </div>
            </div>

            {/* Error Body */}
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                The application encountered an unexpected error. This has been logged for debugging.
              </p>

              {/* Error Details (Collapsible) */}
              <details className="bg-gray-50 rounded-lg overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  🔍 Technical Details
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-mono text-red-800 break-all">
                      {this.state.error?.message || 'Unknown error'}
                    </p>
                  </div>
                  {this.state.error?.stack && (
                    <div className="bg-gray-100 rounded-lg p-3 max-h-40 overflow-auto">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div className="bg-gray-100 rounded-lg p-3 max-h-32 overflow-auto">
                      <p className="text-xs font-medium text-gray-700 mb-1">Component Stack:</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack.slice(0, 500)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>

              {/* Recovery Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go Home
                  </button>
                  
                  <button
                    onClick={this.handleReload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload Page
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                If this problem persists, try clearing your browser cache or contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// SPA Redirect Handler
// ============================================================================
function SPARedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if we have a redirect parameter (from 404.html fallback)
    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('redirect');
    
    if (redirectPath) {
      console.log('[SPARedirectHandler] Redirecting to:', redirectPath);
      // Remove the redirect parameter and navigate to the actual path
      navigate(decodeURIComponent(redirectPath), { replace: true });
    }
  }, [location.search, navigate]);

  return null;
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SPARedirectHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
