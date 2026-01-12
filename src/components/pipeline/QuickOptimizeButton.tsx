// ============================================================================
// ENTERPRISE-GRADE QUICK OPTIMIZE BUTTON
// Version: 3.0.0 - SOTA Production Ready
// 
// Features:
// - Bulletproof polling with proper cleanup
// - Graceful error handling
// - Real-time progress tracking
// - Beautiful UI with animations
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface QuickOptimizeButtonProps {
  url: string;
  title?: string;
  disabled?: boolean;
  onComplete?: (result: OptimizationResult) => void;
  onError?: (error: string) => void;
}

interface OptimizationResult {
  title?: string;
  optimizedTitle?: string;
  optimizedContent?: string;
  content?: string;
  wordCount?: number;
  qualityScore?: number;
  seoScore?: number;
  readabilityScore?: number;
  metaDescription?: string;
  sections?: Array<{ type: string; content?: string; data?: unknown }>;
}

interface JobRecord {
  id: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number | null;
  current_step: string | null;
  result: OptimizationResult | null;
  error_message: string | null;
}

type OptimizeState = 'idle' | 'starting' | 'polling' | 'complete' | 'error';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QuickOptimizeButton({ 
  url, 
  title, 
  disabled = false,
  onComplete,
  onError
}: QuickOptimizeButtonProps) {
  // State
  const [state, setState] = useState<OptimizeState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs for cleanup and tracking
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(0);
  const pollCountRef = useRef(0);

  // ========================================================================
  // CLEANUP
  // ========================================================================
  
  const stopAllIntervals = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAllIntervals();
    };
  }, [stopAllIntervals]);

  // ========================================================================
  // POLL JOB STATUS
  // ========================================================================
  
  const pollJobStatus = useCallback(async (targetJobId: string) => {
    if (!mountedRef.current) return;

    pollCountRef.current += 1;
    const pollNum = pollCountRef.current;

    try {
      console.log(`[Poll #${pollNum}] Checking job: ${targetJobId}`);
      
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('id, status, progress, current_step, result, error_message')
        .eq('id', targetJobId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (fetchError) {
        console.error(`[Poll #${pollNum}] Fetch error:`, fetchError);
        return; // Don't stop polling on transient errors
      }

      if (!data) {
        console.warn(`[Poll #${pollNum}] Job not found, waiting...`);
        return;
      }

      const job = data as JobRecord;
      console.log(`[Poll #${pollNum}] Status: ${job.status}, Progress: ${job.progress}%`);

      // Update UI state
      setProgress(job.progress ?? 0);
      setCurrentStep(job.current_step ?? 'Processing...');

      // Handle completion
      if (job.status === 'completed') {
        console.log(`[Poll #${pollNum}] ✅ Job completed!`);
        stopAllIntervals();
        
        setState('complete');
        setResult(job.result);
        
        toast.success('Optimization complete!', {
          description: `Quality Score: ${job.result?.qualityScore ?? 'N/A'}/100`
        });
        
        if (onComplete && job.result) {
          onComplete(job.result);
        }
      }

      // Handle failure
      if (job.status === 'failed') {
        console.error(`[Poll #${pollNum}] ❌ Job failed:`, job.error_message);
        stopAllIntervals();
        
        const errorMsg = job.error_message ?? 'Optimization failed';
        setState('error');
        setError(errorMsg);
        
        toast.error('Optimization failed', { description: errorMsg });
        
        if (onError) {
          onError(errorMsg);
        }
      }

    } catch (err) {
      console.error(`[Poll #${pollNum}] Exception:`, err);
      // Continue polling on exceptions
    }
  }, [stopAllIntervals, onComplete, onError]);

  // ========================================================================
  // START OPTIMIZATION
  // ========================================================================
  
  const handleOptimize = async () => {
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    // Reset state
    setState('starting');
    setJobId(null);
    setProgress(0);
    setCurrentStep('Initializing...');
    setError(null);
    setResult(null);
    setElapsedTime(0);
    pollCountRef.current = 0;
    startTimeRef.current = Date.now();

    // Start timer
    timeIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    try {
      console.log('[Optimize] Starting optimization for:', url);

      // Call Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke(
        'optimize-content',
        {
          body: { 
            url, 
            postTitle: title || url,
            siteUrl: url
          }
        }
      );

      if (!mountedRef.current) return;

      console.log('[Optimize] Edge function response:', data, invokeError);

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to call optimization service');
      }

      if (!data) {
        throw new Error('No response from optimization service');
      }

      if (!data.success) {
        throw new Error(data.error || 'Optimization service returned an error');
      }

      if (!data.jobId) {
        throw new Error('No job ID returned');
      }

      const newJobId = data.jobId;
      console.log('[Optimize] Job created:', newJobId);
      
      setJobId(newJobId);
      setState('polling');
      setCurrentStep('Job started, waiting for updates...');

      // Start polling
      pollJobStatus(newJobId); // Initial poll
      
      pollIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          pollJobStatus(newJobId);
        }
      }, 1000); // Poll every second

    } catch (err) {
      console.error('[Optimize] Error:', err);
      stopAllIntervals();
      
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setState('error');
      setError(errorMsg);
      
      toast.error('Failed to start optimization', { description: errorMsg });
      
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  // ========================================================================
  // CANCEL / RETRY
  // ========================================================================
  
  const handleCancel = () => {
    stopAllIntervals();
    setState('idle');
    setJobId(null);
    setProgress(0);
    setCurrentStep('');
    toast.info('Optimization cancelled');
  };

  const handleRetry = () => {
    setState('idle');
    setError(null);
    setResult(null);
    handleOptimize();
  };

  const handleReset = () => {
    stopAllIntervals();
    setState('idle');
    setJobId(null);
    setProgress(0);
    setCurrentStep('');
    setError(null);
    setResult(null);
    setElapsedTime(0);
  };

  // ========================================================================
  // PUBLISH HANDLERS
  // ========================================================================
  
  const handlePublish = async (status: 'draft' | 'publish') => {
    if (!result) return;

    try {
      toast.loading(status === 'publish' ? 'Publishing...' : 'Saving draft...');

      const { data, error: publishError } = await supabase.functions.invoke(
        'publish-to-wordpress',
        {
          body: {
            pageId: jobId,
            title: result.title || result.optimizedTitle || 'Optimized Post',
            content: result.optimizedContent || result.content || '',
            status
          }
        }
      );

      toast.dismiss();

      if (publishError) {
        throw new Error(publishError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Publish failed');
      }

      toast.success(status === 'publish' ? 'Published!' : 'Saved as draft!');
      handleReset();

    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    }
  };

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const isProcessing = state === 'starting' || state === 'polling';

  // ========================================================================
  // RENDER
  // ========================================================================
  
  return (
    <div className="space-y-4">
      {/* Idle State - Show Button */}
      {state === 'idle' && (
        <Button
          onClick={handleOptimize}
          disabled={disabled || !url}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3"
        >
          <Zap className="w-5 h-5 mr-2" />
          Quick Optimize
        </Button>
      )}

      {/* Processing State - Show Progress */}
      {isProcessing && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="font-semibold text-blue-900">Optimizing...</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <Clock className="w-4 h-4" />
              {formatTime(elapsedTime)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-blue-700">{currentStep}</span>
              <span className="font-semibold text-blue-900">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {jobId && (
            <p className="text-xs text-blue-500 font-mono">
              Job: {jobId.slice(0, 8)}...
            </p>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancel} 
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Optimization Failed</span>
          </div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="flex-1"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Complete State - Show Results */}
      {state === 'complete' && result && (
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 text-green-700 mb-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Optimization Complete!</span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {result.qualityScore && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Quality: {result.qualityScore}/100
              </Badge>
            )}
            {result.wordCount && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                Words: {result.wordCount}
              </Badge>
            )}
            {result.seoScore && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                SEO: {result.seoScore}/100
              </Badge>
            )}
          </div>

          {result.optimizedTitle && (
            <p className="text-sm font-medium text-gray-900 mb-1">
              {result.optimizedTitle}
            </p>
          )}
          
          {result.metaDescription && (
            <p className="text-xs text-gray-600 mb-4 line-clamp-2">
              {result.metaDescription}
            </p>
          )}

          <div className="flex gap-2 mb-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handlePublish('draft')}
              className="flex-1"
            >
              Save Draft
            </Button>
            <Button 
              size="sm" 
              onClick={() => handlePublish('publish')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Publish
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            className="w-full text-gray-500"
          >
            Optimize Another
          </Button>
        </div>
      )}
    </div>
  );
}

export default QuickOptimizeButton;
