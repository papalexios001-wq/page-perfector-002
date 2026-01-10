'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';

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
 * ENTERPRISE-GRADE Quick Optimize Button
 * Bulletproof optimization with stunning UI
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
        color: 'bg-blue-500 hover:bg-blue-600',
      };
    if (isComplete)
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

  const state = getButtonState();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleOptimize}
          disabled={isLoading || isComplete}
          title="Quick optimize this URL - Enterprise-grade optimization"
          className={`px-4 py-2.5 rounded-lg transition-all duration-200 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 ${
            isLoading || isComplete ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
          } ${state.color}`}
        >
          {state.icon}
          {state.label}
        </button>
        {error && <span className="text-xs text-red-600 font-medium bg-red-50 px-3 py-1 rounded">{error}</span>}
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
      {blogPost && isComplete && (
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
                <p className="text-sm font-semibold text-gray-900 truncate">{blogPost.title}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs text-blue-700 font-semibold">Author</p>
                <p className="text-sm font-semibold text-gray-900">{blogPost.author || 'AI'}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <p className="text-xs text-purple-700 font-semibold">Components</p>
                <p className="text-sm font-bold text-purple-900">{blogPost.componentCount || 9}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <p className="text-xs text-orange-700 font-semibold">Read Time</p>
                <p className="text-sm font-semibold text-gray-900">{blogPost.readTime || '8'} min</p>
              </div>
            </div>
            
            {blogPost.excerpt && (
              <div className="bg-gray-50 p-3 rounded border-l-4 border-green-500">
                <p className="text-xs text-gray-600 font-semibold mb-1">Excerpt</p>
                <p className="text-sm text-gray-800 line-clamp-2">{blogPost.excerpt}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
