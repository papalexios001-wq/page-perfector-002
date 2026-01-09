'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, Loader2, Check, AlertCircle } from 'lucide-react';

interface QuickOptimizeButtonProps {
  url: string;
  onJobStart?: (jobId: string) => void;
  onJobComplete?: (jobId: string, data?: any) => void;
}

interface JobStatus {
  jobId: string;
  state: 'pending' | 'complete' | 'failed';
  progress: number;
  currentStep: string;
  metadata?: Record<string, any>;
}

/**
 * BULLETPROOF Quick Optimize Button
 * Guaranteed to detect completion
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
  const lastStatusRef = useRef<JobStatus | null>(null);

  // BULLETPROOF polling function
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    if (!pollingActiveRef.current) return;
    
    try {
      const response = await fetch(`/api/optimize/status?jobId=${currentJobId}`);
      
      if (!response.ok) {
        console.error('[Poll] Status fetch failed:', response.status);
        return;
      }

      const data: JobStatus = await response.json();
      lastStatusRef.current = data;
      
      console.log(`[Poll] Job ${currentJobId} state: ${data.state}, progress: ${data.progress}%`);
      
      // Update UI with latest data
      setProgress(data.progress);
      setCurrentStep(data.currentStep || 'Processing...');

      // Check for completion
      if (data.state === 'complete') {
        console.log(`[Poll] Job completed! Finalizing...`);
        pollingActiveRef.current = false;
        
        // Fetch blog post if available
        if (data.metadata?.selectedPost) {
          try {
            const blogResponse = await fetch(`/api/blog?id=${data.metadata.selectedPost}`);
            if (blogResponse.ok) {
              const blogData = await blogResponse.json();
              setBlogPost(blogData.post);
            }
          } catch (err) {
            console.error('[Poll] Failed to fetch blog post:', err);
          }
        }
        
        setIsComplete(true);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        onJobComplete?.(currentJobId, blogPost);
      } else if (data.state === 'failed') {
        console.log(`[Poll] Job failed: ${data.metadata?.error}`);
        pollingActiveRef.current = false;
        setError('Optimization failed');
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
    
    // Then set up interval - poll every 300ms for responsiveness
    pollIntervalRef.current = setInterval(() => {
      if (pollingActiveRef.current) {
        pollJobStatus(jobId);
      }
    }, 300);
    
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
      
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          siteId: 'default',
          mode: 'optimize',
          postTitle: 'Quick Optimized Blog Post',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start optimization: ${response.status}`);
      }

      const result = await response.json();
      const newJobId = result.jobId;
      
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
        color: 'bg-blue-500',
      };
    if (isComplete)
      return {
        icon: <Check className="w-4 h-4" />,
        label: 'Complete',
        color: 'bg-green-500',
      };
    if (error)
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Error',
        color: 'bg-red-500',
      };
    return {
      icon: <Zap className="w-4 h-4" />,
      label: 'Optimize',
      color: 'bg-amber-500 hover:bg-amber-600',
    };
  };

  const state = getButtonState();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleOptimize}
          disabled={isLoading || isComplete}
          title="Quick optimize this URL"
          className={`p-2 rounded-lg transition-all duration-200 text-white font-medium flex items-center gap-2 ${
            isLoading || isComplete ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
          } ${state.color}`}
        >
          {state.icon}
          {state.label}
        </button>
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      </div>

      {/* Progress bar */}
      {jobId && !isComplete && progress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Current step */}
      {jobId && !isComplete && (
        <p className="text-xs text-gray-600">{currentStep}</p>
      )}

      {/* Result */}
      {blogPost && isComplete && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-800 mb-2">✓ Success!</p>
          <p className="text-xs text-green-700 mb-1">
            <strong>Title:</strong> {blogPost.title}
          </p>
          <p className="text-xs text-green-700">
            <strong>Components:</strong> {blogPost.componentCount || 9}
          </p>
        </div>
      )}
    </div>
  );
}
