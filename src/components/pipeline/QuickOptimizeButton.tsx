// src/components/pipeline/QuickOptimizeButton.tsx
// ============================================================================
// ENTERPRISE-GRADE QUICK OPTIMIZE BUTTON v5.0
// FIXES: Polling, Progress Tracking, Error Handling
// ============================================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Zap, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ResultsModal } from './ResultsModal';

interface QuickOptimizeButtonProps {
  url: string;
  title?: string;
  disabled?: boolean;
  onComplete?: (result: any) => void;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  result?: any;
  error_message?: string;
}

export function QuickOptimizeButton({ 
  url, 
  title, 
  disabled = false,
  onComplete 
}: QuickOptimizeButtonProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingActiveRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    pollingActiveRef.current = false;
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
    return cleanup;
  }, [cleanup]);

  // Poll job status
  const pollJobStatus = useCallback(async (jobIdToCheck: string) => {
    if (!pollingActiveRef.current) return;

    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobIdToCheck)
        .single();

      if (jobError) {
        console.error('[Poll] Error fetching job:', jobError);
        return;
      }

      if (!jobData) {
        console.warn('[Poll] No job data found');
        return;
      }

      console.log(`[Poll] Job ${jobIdToCheck}: ${jobData.progress}% - ${jobData.current_step}`);

      // Update UI
      setProgress(jobData.progress || 0);
      setCurrentStep(jobData.current_step || 'Processing...');

      // Handle completion
      if (jobData.status === 'completed') {
        console.log('[Poll] Job completed!', jobData.result);
        cleanup();
        setIsOptimizing(false);
        setResult(jobData.result);
        setShowResults(true);
        toast.success('Optimization complete!');
        onComplete?.(jobData.result);
      }

      // Handle failure
      if (jobData.status === 'failed') {
        console.error('[Poll] Job failed:', jobData.error_message);
        cleanup();
        setIsOptimizing(false);
        setError(jobData.error_message || 'Optimization failed');
        toast.error(jobData.error_message || 'Optimization failed');
      }

    } catch (err) {
      console.error('[Poll] Exception:', err);
    }
  }, [cleanup, onComplete]);

  // Start optimization
  const handleOptimize = async () => {
    if (!url) {
      toast.error('Please enter a URL to optimize');
      return;
    }

    // Reset state
    setIsOptimizing(true);
    setProgress(0);
    setCurrentStep('Starting optimization...');
    setError(null);
    setResult(null);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    // Start elapsed time counter
    timeIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      console.log('[Optimize] Starting for URL:', url);

      // Call the Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('optimize-content', {
        body: {
          url: url,
          postTitle: title || url,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to start optimization');
      }

      if (!data?.success || !data?.jobId) {
        throw new Error(data?.error || 'Invalid response from server');
      }

      console.log('[Optimize] Job created:', data.jobId);
      setJobId(data.jobId);

      // Start polling
      pollingActiveRef.current = true;
      pollIntervalRef.current = setInterval(() => {
        if (pollingActiveRef.current) {
          pollJobStatus(data.jobId);
        }
      }, 500); // Poll every 500ms

      // Initial poll
      pollJobStatus(data.jobId);

    } catch (err) {
      console.error('[Optimize] Error:', err);
      cleanup();
      setIsOptimizing(false);
      const message = err instanceof Error ? err.message : 'Failed to start optimization';
      setError(message);
      toast.error(message);
    }
  };

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Optimize Button */}
        {!isOptimizing && !result && (
          <Button
            onClick={handleOptimize}
            disabled={disabled || !url}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 shadow-lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            Quick Optimize
          </Button>
        )}

        {/* Progress UI */}
        {isOptimizing && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="font-semibold text-blue-900">Optimizing Content</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Clock className="w-4 h-4" />
                {formatTime(elapsedTime)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">{currentStep}</span>
                <span className="font-semibold text-blue-900">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3 bg-blue-100" />
            </div>

            {/* Cancel Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cleanup();
                setIsOptimizing(false);
                toast.info('Optimization cancelled');
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && !isOptimizing && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span className="font-semibold">Optimization Failed</span>
            </div>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <Button
              onClick={handleOptimize}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Success Display */}
        {result && !isOptimizing && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Optimization Complete!</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Badge variant="secondary">
                Score: {result.qualityScore || 'N/A'}
              </Badge>
              <Badge variant="secondary">
                Words: {result.wordCount || 'N/A'}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => setShowResults(true)}
                size="sm"
              >
                View Results
              </Button>
              <Button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                variant="outline"
                size="sm"
              >
                Optimize Another
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {showResults && result && (
        <ResultsModal
          isOpen={showResults}
          onClose={() => setShowResults(false)}
          result={result}
          pageId={jobId || ''}
        />
      )}
    </>
  );
}

export default QuickOptimizeButton;
