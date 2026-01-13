// ============================================================================
// QUICK OPTIMIZE - SOTA VERSION v6.0
// CRITICAL: Passes word count settings from Configuration
// ============================================================================

import { useState, useCallback, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Target, FileText, Send, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Settings, FileDigit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { usePagesStore } from '@/stores/pages-store';
import { useConfigStore } from '@/stores/config-store';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Error Boundary
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
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-medium text-red-900">Rendering Error</p>
          <p className="text-sm text-red-700">{this.state.error?.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Types
interface JobData {
  id: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  result?: any;
  error_message?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function QuickOptimize() {
  const { addActivityLog } = usePagesStore();
  const { ai, advanced, wordpress } = useConfigStore();
  
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
  const [blogPost, setBlogPost] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Publish State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; postUrl?: string; error?: string } | null>(null);
  
  // Refs
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(0);

  // Check if AI is configured
  const isAiConfigured = Boolean(ai.apiKey && ai.provider && ai.model);
  const isWpConfigured = Boolean(wordpress.siteUrl && wordpress.username && wordpress.applicationPassword);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!mountedRef.current) return;

    try {
      const { data: jobData, error: queryError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', currentJobId)
        .single();

      if (!mountedRef.current) return;

      if (queryError || !jobData) return;

      const job = jobData as JobData;
      
      if (mountedRef.current) {
        setProgress(job.progress || 0);
        setStatusMessage(job.current_step || 'Processing...');
      }

      // Handle completion
      if (job.status === 'completed' && job.result) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (mountedRef.current) {
          setBlogPost(job.result);
          setIsComplete(true);
          setIsOptimizing(false);
          
          const targetMet = job.result.wordCountMet ? '✓' : '⚠';
          toast.success('Optimization Complete!', {
            description: `${targetMet} ${job.result.wordCount} words • Quality: ${job.result.qualityScore}/100`,
          });
        }
      }

      // Handle failure
      if (job.status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (mountedRef.current) {
          setError(job.error_message || 'Optimization failed');
          setIsOptimizing(false);
          setIsComplete(true);
          
          toast.error('Optimization Failed', {
            description: job.error_message || 'Unknown error',
          });
        }
      }
    } catch (err) {
      console.error('[Poll] Exception:', err);
    }
  }, []);

  // Handle optimize
  const handleOptimize = async () => {
    if (!pageUrl.trim()) {
      toast.error('Please enter a page URL or topic');
      return;
    }

    if (!isAiConfigured) {
      toast.error('AI Provider not configured', {
        description: 'Go to Configuration tab to set up your AI provider.',
      });
      return;
    }

    // Reset state
    setIsOptimizing(true);
    setProgress(0);
    setStatusMessage('Initializing...');
    setError(null);
    setIsComplete(false);
    setBlogPost(null);
    setJobId(null);
    setElapsedTime(0);
    setPublishResult(null);
    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = setInterval(() => {
      if (mountedRef.current) {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    try {
      console.log('[QuickOptimize] Starting optimization...');
      console.log('[QuickOptimize] Word count settings:', advanced.minWordCount, '-', advanced.maxWordCount);

      // Build AI config payload
      const aiConfigPayload = {
        provider: ai.provider,
        apiKey: ai.apiKey,
        model: ai.model,
      };

      // Build content settings from advanced config
      const contentSettings = {
        minWordCount: advanced.minWordCount || 2000,
        maxWordCount: advanced.maxWordCount || 3000,
        enableFaqs: advanced.enableFaqs ?? true,
        enableToc: advanced.enableToc ?? true,
        enableKeyTakeaways: advanced.enableKeyTakeaways ?? true,
      };

      console.log('[QuickOptimize] Content settings:', contentSettings);

      // Call edge function WITH AI CONFIG AND CONTENT SETTINGS
      const { data, error: invokeError } = await supabase.functions.invoke('optimize-content', {
        body: {
          url: pageUrl,
          siteUrl: pageUrl,
          postTitle: targetKeyword || pageUrl,
          keyword: targetKeyword || undefined,
          outputMode: outputMode,
          aiConfig: aiConfigPayload,
          contentSettings: contentSettings, // CRITICAL: Pass word count settings!
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to start optimization');
      }

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Optimization service returned an error');
      }

      if (!data?.jobId) {
        throw new Error('No job ID returned');
      }

      const newJobId = data.jobId;
      console.log('[QuickOptimize] Job created:', newJobId);
      setJobId(newJobId);
      setStatusMessage(`Generating ${contentSettings.minWordCount}-${contentSettings.maxWordCount} word article...`);
      setProgress(5);

      // Start polling
      setTimeout(() => {
        if (mountedRef.current) {
          pollJobStatus(newJobId);
        }
      }, 500);
      
      pollingRef.current = setInterval(() => {
        if (mountedRef.current) {
          pollJobStatus(newJobId);
        }
      }, 1000);

    } catch (err: any) {
      console.error('[QuickOptimize] Error:', err);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (mountedRef.current) {
        setStatusMessage('Optimization failed');
        setError(err.message || 'An unexpected error occurred');
        setIsOptimizing(false);
        setIsComplete(true);
        
        toast.error('Optimization Failed', {
          description: err.message,
        });
      }
    }
  };

  // Handle publish to WordPress
  const handlePublish = async () => {
    if (!blogPost || !isWpConfigured) {
      toast.error('WordPress not configured', {
        description: 'Go to Configuration tab to set up WordPress.',
      });
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      console.log('[QuickOptimize] Publishing to WordPress...');

      const { data, error: publishError } = await supabase.functions.invoke('publish-to-wordpress', {
        body: {
          title: blogPost.title || blogPost.optimizedTitle,
          content: blogPost.content || blogPost.optimizedContent,
          excerpt: blogPost.excerpt,
          metaDescription: blogPost.metaDescription,
          status: outputMode === 'publish' ? 'publish' : 'draft',
          // WordPress credentials from config
          wpUrl: wordpress.siteUrl,
          wpUsername: wordpress.username,
          wpPassword: wordpress.applicationPassword,
        }
      });

      if (publishError) {
        throw new Error(publishError.message || 'Failed to publish');
      }

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Publishing failed');
      }

      setPublishResult({
        success: true,
        postUrl: data.postUrl || data.editUrl,
      });

      toast.success('Published Successfully!', {
        description: `Post ${outputMode === 'publish' ? 'published' : 'saved as draft'} to WordPress`,
      });

    } catch (err: any) {
      console.error('[QuickOptimize] Publish error:', err);
      
      setPublishResult({
        success: false,
        error: err.message,
      });

      toast.error('Publish Failed', {
        description: err.message,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle reset
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
    setElapsedTime(0);
    setPublishResult(null);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
        {/* AI Configuration Status */}
        <div className={`p-2 rounded-lg border ${isAiConfigured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {isAiConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-800">
                  <strong>{ai.provider}</strong> • {ai.model}
                </p>
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 text-amber-600" />
                <p className="text-xs text-amber-800">
                  AI not configured. <strong>Go to Configuration tab</strong>.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Word Count Target Display */}
        {isAiConfigured && (
          <div className="p-2 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2">
              <FileDigit className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-blue-800">
                Target: <strong>{advanced.minWordCount || 2000}-{advanced.maxWordCount || 3000} words</strong>
                <span className="text-blue-600 ml-1">(Configure in Advanced Settings)</span>
              </p>
            </div>
          </div>
        )}

        {/* Input Form */}
        {!isComplete && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Page URL / Topic *</Label>
              <Input
                placeholder="Enter URL or topic like 'best running shoes 2025'"
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
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Optimizing...</span>
              </div>
              <span className="text-xs text-blue-600">{formatTime(elapsedTime)}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-700">{statusMessage}</span>
                <span className="font-mono text-blue-900">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            {jobId && (
              <p className="text-xs text-blue-500 font-mono">Job: {jobId.slice(0, 8)}...</p>
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
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Optimization Failed</p>
                <p className="text-xs text-red-700">{error}</p>
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
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Optimization Complete!</p>
                <p className="text-xs text-green-700">
                  {blogPost.wordCountMet ? '✓' : '⚠'} {blogPost.wordCount} words
                  {blogPost.targetWordCount && (
                    <span className="text-green-600"> (target: {blogPost.targetWordCount.min}-{blogPost.targetWordCount.max})</span>
                  )}
                  {' '}• Quality: {blogPost.qualityScore || 'N/A'}/100
                </p>
              </div>
            </div>
            
            {/* Results Preview */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-green-100">
              <h4 className="font-medium text-gray-900 text-sm mb-1">
                {blogPost.title || blogPost.optimizedTitle || 'Optimized Content'}
              </h4>
              {blogPost.metaDescription && (
                <p className="text-xs text-gray-600 line-clamp-2">{blogPost.metaDescription}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="secondary" className="text-xs">Words: {blogPost.wordCount}</Badge>
                {blogPost.qualityScore && (
                  <Badge variant="secondary" className="text-xs">Quality: {blogPost.qualityScore}</Badge>
                )}
                {blogPost.h2s?.length > 0 && (
                  <Badge variant="secondary" className="text-xs">Sections: {blogPost.h2s.length}</Badge>
                )}
              </div>
            </div>

            {/* Publish Button */}
            {isWpConfigured && !publishResult?.success && (
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full mt-3 gap-2"
                variant="default"
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isPublishing ? 'Publishing...' : `Publish to WordPress (${outputMode})`}
              </Button>
            )}

            {/* Publish Result */}
            {publishResult && (
              <div className={`mt-3 p-2 rounded-lg border ${publishResult.success ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                {publishResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-800">Published successfully!</span>
                    {publishResult.postUrl && (
                      <a href={publishResult.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-800">{publishResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Action Button */}
        {!isComplete ? (
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing || !pageUrl.trim() || !isAiConfigured}
            className="w-full gap-2"
            variant="default"
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isOptimizing 
              ? 'Optimizing...' 
              : `Generate ${advanced.minWordCount || 2000}-${advanced.maxWordCount || 3000} Word Article`
            }
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
      </CardContent>
    </Card>
  );
}

export default QuickOptimize;
