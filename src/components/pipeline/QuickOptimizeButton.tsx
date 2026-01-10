'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { BlogPostDisplay } from '../blog/BlogPostDisplay';
import { invokeEdgeFunction } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';

interface QuickOptimizeButtonProps {
  url: string;
  onJobStart?: (jobId: string) => void;
  onJobComplete?: (jobId: string, data?: any) => void;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  result?: any;
  error_message?: string;
}

/**
 * ENTERPRISE-GRADE Quick Optimize Button
 * Uses Supabase Edge Functions for backend processing
 */
export function QuickOptimizeButton({
  url,
  onJobStart,
  onJobComplete,
}: QuickOptimizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Awaiting start...');
  const [blogPost, setBlogPost] = useState<any>(null);
  
  const pollingActiveRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll job status from Supabase database
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!pollingActiveRef.current) return;
    
    try {
      // Query the jobs table directly from Supabase
      const { data: jobData, error: queryError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', currentJobId)
        .single();

      if (queryError) {
        console.error('[Poll] Error fetching job:', queryError);
        return;
      }

      if (!jobData) {
        console.error('[Poll] Job not found:', currentJobId);
        return;
      }

      const job = jobData as JobStatus;
      
      console.log(`[Poll] Job ${currentJobId} status: ${job.status}, progress: ${job.progress}%`);
      
      // Update UI with latest data
      setProgress(job.progress || 0);
      setCurrentStep(job.current_step || 'Processing...');

      // Check for completion
      if (job.status === 'completed') {
  console.log(`[Poll] Job completed! Finalizing...`);
  console.log('[Poll] Job result:', JSON.stringify(job.result, null, 2));
  pollingActiveRef.current = false;
  
  // Set blog post from job result
  if (job.result) {
    console.log('[Poll] Setting blogPost state with result');
    setBlogPost(job.result);
  } else {
    console.error('[Poll] No result in completed job!');
  }

        
        setIsComplete(true);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        onJobComplete?.(currentJobId, job.result);
      } else if (job.status === 'failed') {
        console.log(`[Poll] Job failed: ${job.error_message}`);
        pollingActiveRef.current = false;
        setError(job.error_message || 'Optimization failed');
        setIsComplete(true);
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('[Poll] Error:', err);
      // Keep polling even on error
    }
  }, [onJobComplete]);

  // Start polling when jobId changes
  useEffect(() => {
    if (!jobId) return;
    
    console.log(`[Effect] Starting polling for job: ${jobId}`);
    
    pollingActiveRef.current = true;
    
    // Poll immediately
    pollJobStatus(jobId);
    
    // Then set up interval - poll every 500ms for responsiveness
    pollIntervalRef.current = setInterval(() => {
      if (pollingActiveRef.current) {
        pollJobStatus(jobId);
      }
    }, 500);
    
    return () => {
      console.log(`[Effect] Cleanup: stopping polling`);
      pollingActiveRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [jobId, pollJobStatus]);

  const handleOptimize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsComplete(false);
      setProgress(0);
      setBlogPost(null);
      pollingActiveRef.current = false;
      console.log('[Click] Starting optimization for URL:', url);
      
      // Call Supabase Edge Function instead of /api/optimize
      const { data, error: invokeError } = await invokeEdgeFunction<{
        success: boolean;
        jobId?: string;
        message?: string;
        error?: string;
      }>('optimize-content', {
        url,
        siteId: 'default',
        mode: 'optimize',
        postTitle: 'Quick Optimized Blog Post',
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to start optimization');
      }

      if (!data?.success || !data?.jobId) {
        throw new Error(data?.error || data?.message || 'Failed to start optimization');
      }

      const newJobId = data.jobId;
      
      console.log('[Click] Optimization started with jobId:', newJobId);
      
      setJobId(newJobId);
      setIsLoading(false);
      onJobStart?.(newJobId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Click] Error starting optimization:', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  }, [url, onJobStart]);

  const getButtonState = () => {
    if (isLoading || (jobId && !isComplete))
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: `Optimizing... ${progress}%`,
        color: 'bg-blue-500 hover:bg-blue-600',
      };
    if (isComplete && !error)
      return {
        icon: <Check className="w-4 h-4" />,
        label: 'Complete',
        color: 'bg-green-500 hover:bg-green-600',
      };
    if (error)
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Error',
        color: 'bg-red-500 hover:bg-red-600',
      };
    return {
      icon: <Zap className="w-4 h-4" />,
      label: 'Optimize',
      color: 'bg-amber-500 hover:bg-amber-600',
    };
  };

  const handleReset = () => {
    setJobId(null);
    setIsComplete(false);
    setError(null);
    setProgress(0);
    setBlogPost(null);
    setCurrentStep('Awaiting start...');
  };

  const state = getButtonState();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={isComplete ? handleReset : handleOptimize}
          disabled={isLoading || (jobId && !isComplete)}
          title="Quick optimize this URL - Enterprise-grade optimization"
          className={`px-4 py-2.5 rounded-lg transition-all duration-200 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 ${
            isLoading || (jobId && !isComplete) ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
          } ${state.color}`}
        >
          {state.icon}
          {isComplete ? (error ? 'Try Again' : 'Optimize Another') : state.label}
        </button>
        {error && (
          <span className="text-xs text-red-600 font-medium bg-red-50 px-3 py-1 rounded">
            {error}
          </span>
        )}
      </div>

      {/* Enterprise Progress Bar */}
      {jobId && !isComplete && progress > 0 && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 h-full transition-all duration-300 ease-out shadow-lg relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700">{currentStep}</p>
            <p className="text-sm font-bold text-blue-600">{progress}%</p>
          </div>
        </div>
      )}

      {/* Current step indicator */}
      {jobId && !isComplete && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Sparkles className="w-4 h-4 text-yellow-500 animate-spin" />
          <span>Processing optimization stages...</span>
        </div>
      )}

      {/* Result - Styled Blog Post Box */}
      {blogPost && isComplete && !error && (
        <div className="mt-4 p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-lg">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-900 mb-1">Optimization Complete!</h3>
              <p className="text-sm text-green-700">Your content has been enhanced with enterprise-grade optimization.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-3 rounded">
                <p className="text-xs text-green-700 font-semibold">Title</p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {blogPost.title || blogPost.optimizedTitle || 'Optimized Post'}
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs text-blue-700 font-semibold">Author</p>
                <p className="text-sm font-semibold text-gray-900">{blogPost.author || 'AI'}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="text-xs text-purple-700 font-semibold">Quality Score</p>
                <p className="text-sm font-bold text-purple-900">
                  {blogPost.qualityScore || blogPost.componentCount || 85}/100
                </p>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <p className="text-xs text-orange-700 font-semibold">Word Count</p>
                <p className="text-sm font-semibold text-gray-900">
                  {blogPost.contentStrategy?.wordCount || blogPost.wordCount || '2000+'}
                </p>
              </div>
            </div>
            
            {(blogPost.excerpt || blogPost.metaDescription) && (
              <div className="bg-gray-50 p-3 rounded border-l-4 border-green-500">
                <p className="text-xs text-gray-600 font-semibold mb-1">Summary</p>
                <p className="text-sm text-gray-800 line-clamp-2">
                  {blogPost.excerpt || blogPost.metaDescription}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blog Post Display - SOTA HTML Rendering */}
      {isComplete && blogPost && !error && (
        <div className="mt-8 border-t-2 border-gray-200 pt-8">
          <BlogPostDisplay 
            post={blogPost} 
            isLoading={false} 
          />
        </div>
      )}
    </div>
  );
}

export default QuickOptimizeButton;
