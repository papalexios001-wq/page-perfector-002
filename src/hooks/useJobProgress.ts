// src/hooks/useJobProgress.ts
// ============================================================================
// JOB PROGRESS HOOK - Real-time job status tracking
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface JobProgress {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  result?: any;
  error?: string;
}

interface UseJobProgressOptions {
  pollingInterval?: number;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export function useJobProgress(
  jobId: string | null,
  options: UseJobProgressOptions = {}
) {
  const { 
    pollingInterval = 500, 
    onComplete, 
    onError 
  } = options;

  const [job, setJob] = useState<JobProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchJobStatus = useCallback(async (id: string) => {
    if (!activeRef.current) return;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[useJobProgress] Fetch error:', error);
        return;
      }

      if (!data) return;

      const jobProgress: JobProgress = {
        id: data.id,
        status: data.status,
        progress: data.progress || 0,
        currentStep: data.current_step || 'Processing...',
        result: data.result,
        error: data.error_message,
      };

      setJob(jobProgress);

      // Handle completion
      if (data.status === 'completed') {
        cleanup();
        setIsLoading(false);
        onComplete?.(data.result);
      }

      // Handle failure
      if (data.status === 'failed') {
        cleanup();
        setIsLoading(false);
        onError?.(data.error_message || 'Job failed');
      }

    } catch (err) {
      console.error('[useJobProgress] Exception:', err);
    }
  }, [cleanup, onComplete, onError]);

  useEffect(() => {
    if (!jobId) {
      cleanup();
      setJob(null);
      return;
    }

    setIsLoading(true);
    activeRef.current = true;

    // Initial fetch
    fetchJobStatus(jobId);

    // Start polling
    pollRef.current = setInterval(() => {
      if (activeRef.current) {
        fetchJobStatus(jobId);
      }
    }, pollingInterval);

    return cleanup;
  }, [jobId, pollingInterval, fetchJobStatus, cleanup]);

  return {
    job,
    isLoading,
    progress: job?.progress || 0,
    currentStep: job?.currentStep || '',
    status: job?.status || 'pending',
    result: job?.result,
    error: job?.error,
    isComplete: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    isRunning: job?.status === 'running',
  };
}

export default useJobProgress;
