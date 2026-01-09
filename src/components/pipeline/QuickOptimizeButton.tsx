'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Zap, Loader2, Check, AlertCircle, Download } from 'lucide-react';

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
 * THUNDER ICON - Quick Optimize Button with Real-time Polling
 * Instantly starts URL optimization and polls for completion
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

  // Poll for job status
  useEffect(() => {
    if (!jobId || isComplete) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/optimize/status?jobId=${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data: JobStatus = await response.json();
        setProgress(data.progress);
        setCurrentStep(data.currentStep || 'Processing...');

        if (data.state === 'complete') {
          // Fetch the blog post data
          if (data.metadata?.selectedPost) {
            const blogResponse = await fetch(
              `/api/blog?id=${data.metadata.selectedPost}`
            );
            if (blogResponse.ok) {
              const blogData = await blogResponse.json();
              setBlogPost(blogData.post);
            }
          }

          setIsComplete(true);
          onJobComplete?.(jobId, blogPost);
          clearInterval(pollInterval);
        } else if (data.state === 'failed') {
          setError('Optimization failed');
          setIsComplete(true);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 500); // Poll every 500ms for real-time updates

    return () => clearInterval(pollInterval);
  }, [jobId, isComplete, onJobComplete]);

  const handleOptimize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsComplete(false);
      setProgress(0);
      setBlogPost(null);

      // Start optimization job
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

      if (!response.ok) throw new Error('Failed to start optimization');

      const result = await response.json();
      const newJobId = result.jobId;
      setJobId(newJobId);
      onJobStart?.(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [url, onJobStart]);

  useEffect(() => {
    if (isComplete) {
      setIsLoading(false);
    }
  }, [isComplete]);

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
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Current step display */}
      {jobId && !isComplete && (
        <p className="text-xs text-gray-600">{currentStep}</p>
      )}

      {/* Blog post result */}
      {blogPost && isComplete && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-800 mb-2">
            ✓ Blog Post Generated!
          </p>
          <p className="text-xs text-green-700 mb-2">
            <strong>Title:</strong> {blogPost.title}
          </p>
          <p className="text-xs text-green-700 mb-2">
            <strong>Components:</strong> {blogPost.componentCount || 9} beautiful HTML boxes
          </p>
          <p className="text-xs text-green-700">
            <strong>Read Time:</strong> {blogPost.readTime || '5-7 min'}
          </p>
        </div>
      )}
    </div>
  );
}
