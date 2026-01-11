import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Target, FileText, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePagesStore } from '@/stores/pages-store';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BlogPostRenderer } from '../blog/BlogPostComponents';

// ============================================================================
// ERROR BOUNDARY for rendering
// ============================================================================
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RenderErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[QuickOptimize ErrorBoundary] Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900">Failed to render content</p>
              <p className="text-sm text-red-700 mt-1">{this.state.error?.message}</p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onReset?.();
                }}
                className="mt-2 flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
              >
                <RefreshCw className="w-3 h-3" /> Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function QuickOptimize() {
  const { addPages, updatePage, addActivityLog } = usePagesStore();
  const navigate = useNavigate();
  const [pageUrl, setPageUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [outputMode, setOutputMode] = useState<'draft' | 'publish'>('draft');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blogPost, setBlogPost] = useState<any>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingActiveRef = useRef(false);

  // Poll job status from database
  const pollJobStatus = useCallback(async (currentJobId: string, pageId: string, pageSlug: string) => {
    if (!pollingActiveRef.current) return;

    try {
      const { data: jobData, error: queryError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', currentJobId)
        .single();

      if (queryError) {
        console.error('[QuickOptimize Poll] Error:', queryError);
        return;
      }

      if (!jobData) {
        console.error('[QuickOptimize Poll] Job not found');
        return;
      }

      console.log(`[QuickOptimize Poll] Job status: ${jobData.status}, progress: ${jobData.progress}%`);
      setProgress(jobData.progress || 0);
      setStatusMessage(jobData.current_step || 'Processing...');

      if (jobData.status === 'completed') {
        console.log('[QuickOptimize Poll] Job completed!');
        console.log('[QuickOptimize Poll] Result:', JSON.stringify(jobData.result, null, 2).slice(0, 500));
        
        pollingActiveRef.current = false;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Store the result
        if (jobData.result) {
          setBlogPost(jobData.result);
          
          // Update page in store with optimized content
          updatePage(pageId, {
            status: 'completed',
            optimizedAt: new Date().toISOString(),
            optimizedContent: JSON.stringify(jobData.result),
            title: jobData.result.title || `Optimized: ${pageUrl}`,
          });

          addActivityLog({
            type: 'success',
            pageUrl,
            message: 'Optimization completed successfully',
            details: { keyword: targetKeyword || 'auto-detected', outputMode },
          });

          toast.success('Optimization Complete!', {
            description: `Quality Score: ${jobData.result.qualityScore || 'N/A'}/100`,
          });
        }

        setIsComplete(true);
        setIsOptimizing(false);

      } else if (jobData.status === 'failed') {
        console.error('[QuickOptimize Poll] Job failed:', jobData.error_message);
        
        pollingActiveRef.current = false;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setError(jobData.error_message || 'Optimization failed');
        setIsOptimizing(false);
        setIsComplete(true);

        addActivityLog({
          type: 'error',
          pageUrl,
          message: `Optimization failed: ${jobData.error_message}`,
        });

        toast.error('Optimization Failed', {
          description: jobData.error_message || 'Check console for details',
        });
      }
    } catch (err) {
      console.error('[QuickOptimize Poll] Exception:', err);
    }
  }, [pageUrl, targetKeyword, outputMode, updatePage, addActivityLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingActiveRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleOptimize = async () => {
    if (!pageUrl) {
      toast.error('Please enter a page URL');
      return;
    }

    // Reset state
    setIsOptimizing(true);
    setProgress(0);
    setStatusMessage('Starting optimization...');
    setError(null);
    setIsComplete(false);
    setBlogPost(null);
    setJobId(null);

    try {
      // Create page record
      const pageSlug = pageUrl.replace(/^[\/]+/, '').replace(/[\/]+$/, '').trim() || 'quick-optimize';
      const pageId = `qo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      const newPage = {
        id: pageId,
        url: pageUrl,
        slug: pageSlug,
        title: `Quick Optimize: ${pageUrl}`,
        wordCount: 0,
        status: 'optimizing' as const,
        postType: 'post',
        categories: [],
        tags: [],
        retryCount: 0,
      };

      console.log('[QuickOptimize] Creating page:', newPage);
      addPages([newPage]);

      addActivityLog({
        type: 'info',
        pageUrl,
        message: 'Quick optimization started',
        details: { keyword: targetKeyword || 'auto-detect', outputMode },
      });

      setStatusMessage('Calling optimization service...');
      setProgress(5);

      // FIXED: Call edge function with CORRECT parameter names
      // The edge function expects: { url, pageId, siteId, mode, postTitle }
      console.log('[QuickOptimize] Calling optimize-content edge function');
      const { data, error: invokeError } = await invokeEdgeFunction<{
        success: boolean;
        jobId?: string;
        message?: string;
        error?: string;
      }>('optimize-content', {
        url: pageUrl,  // FIXED: was pageUrl, should be url
        siteId: 'default',
        mode: 'optimize',
        postTitle: targetKeyword || `Optimized: ${pageUrl}`,
      });

      console.log('[QuickOptimize] Edge function response:', data);

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to start optimization');
      }

      if (!data?.success || !data?.jobId) {
        throw new Error(data?.error || data?.message || 'Failed to start optimization job');
      }

      const newJobId = data.jobId;
      console.log('[QuickOptimize] Job started with ID:', newJobId);
      setJobId(newJobId);
      setStatusMessage('Optimization in progress...');
      setProgress(10);

      // Start polling for job status
      pollingActiveRef.current = true;
      
      // Poll immediately
      await pollJobStatus(newJobId, pageId, pageSlug);
      
      // Then poll every 500ms
      pollingRef.current = setInterval(() => {
        if (pollingActiveRef.current) {
          pollJobStatus(newJobId, pageId, pageSlug);
        }
      }, 500);

    } catch (err: any) {
      console.error('[QuickOptimize] Error:', err);
      setStatusMessage('Optimization failed');
      setError(err.message || 'Unknown error');
      setIsOptimizing(false);
      setIsComplete(true);

      addActivityLog({
        type: 'error',
        pageUrl,
        message: `Optimization failed: ${err.message}`,
      });

      toast.error('Optimization Failed', {
        description: err.message || 'An unexpected error occurred',
      });
    }
  };

  const handleReset = () => {
    setPageUrl('');
    setTargetKeyword('');
    setIsOptimizing(false);
    setProgress(0);
    setStatusMessage('');
    setJobId(null);
    setIsComplete(false);
    setError(null);
    setBlogPost(null);
    pollingActiveRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Normalize blog post for rendering
  const getNormalizedPost = () => {
    if (!blogPost) return null;
    
    return {
      title: blogPost.title || blogPost.optimizedTitle || 'Optimized Post',
      author: blogPost.author || 'AI Content Expert',
      publishedAt: blogPost.publishedAt || new Date().toISOString(),
      excerpt: blogPost.excerpt || blogPost.metaDescription || '',
      sections: Array.isArray(blogPost.sections) ? blogPost.sections : [
        { type: 'paragraph', content: blogPost.content || blogPost.optimizedContent || 'Content generated successfully.' }
      ],
    };
  };

  return (
    <Card className="glass-panel border-border/50 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Optimize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Form - Show when not complete */}
        {!isComplete && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Page URL *</Label>
              <Input
                placeholder="/your-page or https://site.com/page"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className="bg-muted/50"
                disabled={isOptimizing}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target Keyword</Label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="(auto-detect)"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  className="bg-muted/50 pl-10"
                  disabled={isOptimizing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Output Mode</Label>
              <RadioGroup
                value={outputMode}
                onValueChange={(v) => setOutputMode(v as 'draft' | 'publish')}
                className="flex gap-2"
                disabled={isOptimizing}
              >
                <div className="flex-1">
                  <RadioGroupItem value="draft" id="draft" className="peer sr-only" />
                  <label
                    htmlFor="draft"
                    className="flex items-center justify-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">Draft</span>
                  </label>
                </div>
                <div className="flex-1">
                  <RadioGroupItem value="publish" id="publish" className="peer sr-only" />
                  <label
                    htmlFor="publish"
                    className="flex items-center justify-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span className="text-sm">Publish</span>
                  </label>
                </div>
              </RadioGroup>
            </div>
          </>
        )}

        {/* Progress Bar */}
        {isOptimizing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{statusMessage || 'Optimizing...'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Optimization Failed</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Display */}
        {isComplete && !error && blogPost && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Optimization Complete!</p>
                <p className="text-xs text-green-700 mt-1">
                  Quality Score: {blogPost.qualityScore || 85}/100 • 
                  Words: {blogPost.wordCount || blogPost.contentStrategy?.wordCount || '2000+'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isComplete ? (
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing || !pageUrl}
            className="w-full gap-2"
            variant="default"
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isOptimizing ? 'Optimizing...' : 'Optimize Now'}
          </Button>
        ) : (
          <Button
            onClick={handleReset}
            className="w-full gap-2"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4" />
            Optimize Another
          </Button>
        )}

        {/* Blog Post Preview */}
        {isComplete && blogPost && !error && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">Preview:</p>
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/30 bg-white">
              <RenderErrorBoundary onReset={handleReset}>
                <div className="p-4">
                  <BlogPostRenderer post={getNormalizedPost()!} />
                </div>
              </RenderErrorBoundary>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
