// ============================================================================
// QUICK OPTIMIZE - ENTERPRISE-GRADE SOTA CONTENT OPTIMIZATION COMPONENT
// Version: 4.0.0 - FIXED: Now passes AI configuration to Edge Function
// ============================================================================

import { useState, useCallback, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Target, FileText, Send, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePagesStore } from '@/stores/pages-store';
import { useConfigStore } from '@/stores/config-store'; // CRITICAL: Import config store
import { toast } from 'sonner';
import { invokeEdgeFunction, isSupabaseConfigured, getSupabaseStatus } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { BlogPostRenderer } from '../blog/BlogPostComponents';

// ============================================================================
// ERROR BOUNDARY
// ============================================================================
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
// TYPES
// ============================================================================
interface JobData {
  id: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  result?: OptimizationResult;
  error_message?: string;
}

interface OptimizationResult {
  title: string;
  optimizedTitle?: string;
  optimizedContent?: string;
  content?: string;
  wordCount?: number;
  qualityScore?: number;
  seoScore?: number;
  readabilityScore?: number;
  sections?: Array<{ type: string; content?: string; data?: any }>;
  excerpt?: string;
  metaDescription?: string;
  author?: string;
  publishedAt?: string;
  h1?: string;
  h2s?: string[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function QuickOptimize() {
  const { addPages, updatePage, addActivityLog } = usePagesStore();
  const navigate = useNavigate();
  
  // CRITICAL: Get AI configuration from store
  const { ai, wordpress, siteContext, advanced } = useConfigStore();
  
  // Form State
  const [pageUrl, setPageUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [outputMode, setOutputMode] = useState<'draft' | 'publish'>('draft');
  
  // Process State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blogPost, setBlogPost] = useState<OptimizationResult | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Refs for cleanup
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingActiveRef = useRef(false);
  const mountedRef = useRef(true);

  // ========================================================================
  // CHECK CONFIGURATION ON MOUNT
  // ========================================================================
  useEffect(() => {
    mountedRef.current = true;
    
    // Check Supabase configuration
    if (!isSupabaseConfigured()) {
      const status = getSupabaseStatus();
      console.error('[QuickOptimize] Supabase not configured:', status);
      setConfigError('Backend not configured. Please set up Supabase environment variables.');
    }
    
    return () => {
      mountedRef.current = false;
      pollingActiveRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Check if AI is configured
  const isAiConfigured = Boolean(ai.apiKey && ai.provider && ai.model);

  // ========================================================================
  // POLL JOB STATUS
  // ========================================================================
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!pollingActiveRef.current || !mountedRef.current) {
      console.log('[QuickOptimize Poll] Polling stopped');
      return;
    }

    try {
      console.log('[QuickOptimize Poll] Checking job:', currentJobId);
      
      const { data: jobData, error: queryError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', currentJobId)
        .single();

      if (queryError) {
        console.error('[QuickOptimize Poll] Query error:', queryError);
        return;
      }

      if (!jobData) {
        console.warn('[QuickOptimize Poll] Job not found:', currentJobId);
        return;
      }

      const job = jobData as JobData;
      console.log(`[QuickOptimize Poll] Status: ${job.status}, Progress: ${job.progress}%`);
      
      if (mountedRef.current) {
        setProgress(job.progress || 0);
        setStatusMessage(job.current_step || 'Processing...');
      }

      // Handle completion
      if (job.status === 'completed') {
        console.log('[QuickOptimize Poll] Job completed!', job.result);
        
        pollingActiveRef.current = false;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        if (mountedRef.current && job.result) {
          const result = job.result;
          setBlogPost(result);
          
          addActivityLog({
            type: 'success',
            pageUrl,
            message: 'Optimization completed successfully',
            details: { 
              keyword: targetKeyword || 'auto-detected', 
              outputMode,
              qualityScore: result.qualityScore,
              wordCount: result.wordCount,
            },
          });

          toast.success('Optimization Complete!', {
            description: `Quality Score: ${result.qualityScore || 'N/A'}/100 • Words: ${result.wordCount || 'N/A'}`,
          });

          setIsComplete(true);
          setIsOptimizing(false);
        }
      }

      // Handle failure
      if (job.status === 'failed') {
        console.error('[QuickOptimize Poll] Job failed:', job.error_message);
        
        pollingActiveRef.current = false;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        if (mountedRef.current) {
          setError(job.error_message || 'Optimization failed');
          setIsOptimizing(false);
          setIsComplete(true);

          addActivityLog({
            type: 'error',
            pageUrl,
            message: `Optimization failed: ${job.error_message}`,
          });

          toast.error('Optimization Failed', {
            description: job.error_message || 'Check console for details',
          });
        }
      }
    } catch (err) {
      console.error('[QuickOptimize Poll] Exception:', err);
    }
  }, [pageUrl, targetKeyword, outputMode, addActivityLog]);

  // ========================================================================
  // HANDLE OPTIMIZE - NOW PASSES AI CONFIG!
  // ========================================================================
  const handleOptimize = async () => {
    // Validation
    if (!pageUrl.trim()) {
      toast.error('Please enter a page URL');
      return;
    }

    if (!isSupabaseConfigured()) {
      toast.error('Backend not configured', {
        description: 'Please set up Supabase environment variables.',
      });
      return;
    }

    // Warn if AI not configured
    if (!isAiConfigured) {
      toast.warning('AI Provider not configured', {
        description: 'Using fallback content. Configure AI in the Configuration tab for real AI-generated content.',
      });
    }

    // Reset state
    setIsOptimizing(true);
    setProgress(0);
    setStatusMessage('Initializing...');
    setError(null);
    setIsComplete(false);
    setBlogPost(null);
    setJobId(null);

    try {
      setStatusMessage('Calling optimization service...');
      setProgress(5);

      // ====================================================================
      // CRITICAL FIX: Build AI config payload to pass to Edge Function
      // ====================================================================
      const aiConfigPayload = isAiConfigured ? {
        provider: ai.provider,
        apiKey: ai.apiKey,
        model: ai.model,
      } : undefined;

      console.log('[QuickOptimize] AI Config:', {
        provider: ai.provider,
        hasApiKey: !!ai.apiKey,
        model: ai.model,
        isConfigured: isAiConfigured,
      });

      // Call edge function WITH AI CONFIG
      console.log('[QuickOptimize] Invoking optimize-content edge function...');
      const { data, error: invokeError } = await invokeEdgeFunction<{
        success: boolean;
        jobId?: string;
        message?: string;
        error?: string;
      }>('optimize-content', {
        url: pageUrl,
        siteUrl: pageUrl,
        postTitle: targetKeyword || pageUrl,
        keyword: targetKeyword || undefined,
        outputMode: outputMode,
        // ================================================================
        // CRITICAL: Pass the AI configuration!
        // ================================================================
        aiConfig: aiConfigPayload,
        // Also pass other useful context
        siteContext: siteContext ? {
          organizationName: siteContext.organizationName,
          industry: siteContext.industry,
          targetAudience: siteContext.targetAudience,
          brandVoice: siteContext.brandVoice,
        } : undefined,
        advanced: advanced ? {
          targetScore: advanced.targetScore,
          minWordCount: advanced.minWordCount,
          maxWordCount: advanced.maxWordCount,
          enableFaqs: advanced.enableFaqs,
          enableKeyTakeaways: advanced.enableKeyTakeaways,
        } : undefined,
      });

      console.log('[QuickOptimize] Edge function response:', data, invokeError);

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to start optimization');
      }

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Optimization service returned an error');
      }

      if (!data?.jobId) {
        throw new Error('No job ID returned from optimization service');
      }

      const newJobId = data.jobId;
      console.log('[QuickOptimize] Job created with ID:', newJobId);
      setJobId(newJobId);
      setStatusMessage('Optimization in progress...');
      setProgress(10);

      addActivityLog({
        type: 'info',
        pageUrl,
        message: `Quick optimization started with ${isAiConfigured ? ai.provider : 'fallback'} AI`,
        details: { keyword: targetKeyword || 'auto-detect', outputMode, jobId: newJobId, aiProvider: ai.provider },
      });

      // Start polling
      pollingActiveRef.current = true;
      
      setTimeout(() => {
        if (pollingActiveRef.current && mountedRef.current) {
          pollJobStatus(newJobId);
        }
      }, 500);
      
      pollingRef.current = setInterval(() => {
        if (pollingActiveRef.current && mountedRef.current) {
          pollJobStatus(newJobId);
        }
      }, 1000);

    } catch (err: any) {
      console.error('[QuickOptimize] Error:', err);
      
      if (mountedRef.current) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setStatusMessage('Optimization failed');
        setError(errorMessage);
        setIsOptimizing(false);
        setIsComplete(true);

        addActivityLog({
          type: 'error',
          pageUrl,
          message: `Optimization failed: ${errorMessage}`,
        });

        toast.error('Optimization Failed', {
          description: errorMessage,
        });
      }
    }
  };

  // ========================================================================
  // HANDLE RESET
  // ========================================================================
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

  // ========================================================================
  // NORMALIZE BLOG POST FOR RENDERING
  // ========================================================================
  const getNormalizedPost = () => {
    if (!blogPost) return null;
    
    return {
      title: blogPost.title || blogPost.optimizedTitle || 'Optimized Post',
      author: blogPost.author || 'AI Content Expert',
      publishedAt: blogPost.publishedAt || new Date().toISOString(),
      excerpt: blogPost.excerpt || blogPost.metaDescription || '',
      sections: Array.isArray(blogPost.sections) ? blogPost.sections : [
        { type: 'paragraph' as const, content: blogPost.content || blogPost.optimizedContent || 'Content generated successfully.' }
      ],
    };
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <Card className="glass-panel border-border/50 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Optimize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Error Banner */}
        {configError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Configuration Required</p>
                <p className="text-xs text-amber-700 mt-1">{configError}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Not Configured Warning */}
        {!isAiConfigured && !configError && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">AI Provider Not Configured</p>
                <p className="text-xs text-blue-700 mt-1">
                  Go to the <strong>Configuration</strong> tab to set up your AI provider (Google, OpenAI, etc.) for real AI-generated content.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Configured Success Badge */}
        {isAiConfigured && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-800">
                <strong>{ai.provider}</strong> configured • Model: <strong>{ai.model}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Input Form - Show when not complete */}
        {!isComplete && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Page URL / Topic *</Label>
              <Input
                placeholder="/your-page or a topic like 'best running shoes 2025'"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className="bg-muted/50"
                disabled={isOptimizing}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target Keyword (optional)</Label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="(auto-detect from URL/topic)"
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
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {statusMessage || 'Optimizing...'}
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/80"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            {jobId && (
              <p className="text-xs text-muted-foreground/50 font-mono">Job: {jobId.slice(0, 8)}...</p>
            )}
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Optimization Failed</p>
                <p className="text-xs text-red-700 mt-1 break-words">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Display */}
        {isComplete && !error && blogPost && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Optimization Complete!</p>
                <p className="text-xs text-green-700 mt-1">
                  Quality Score: {blogPost.qualityScore || 'N/A'}/100 • 
                  Words: {blogPost.wordCount || 'N/A'} •
                  SEO: {blogPost.seoScore || 'N/A'}/100
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Button */}
        {!isComplete ? (
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing || !pageUrl.trim() || !!configError}
            className="w-full gap-2"
            variant="default"
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isOptimizing ? 'Optimizing...' : isAiConfigured ? `Optimize with ${ai.provider}` : 'Optimize (Fallback)'}
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 pt-4 border-t border-border/50"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Preview:</p>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                <ExternalLink className="w-3 h-3" />
                Full View
              </Button>
            </div>
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border/30 bg-white">
              <RenderErrorBoundary onReset={handleReset}>
                <div className="p-4">
                  <BlogPostRenderer post={getNormalizedPost()!} />
                </div>
              </RenderErrorBoundary>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuickOptimize;
