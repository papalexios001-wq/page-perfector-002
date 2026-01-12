// src/hooks/useJobProgress.ts
// ============================================================================
// SOTA ENTERPRISE-GRADE JOB PROGRESS HOOK
// Real-time job status tracking with dynamic job watching
// v2.0.0 - FIXED: Removed double polling (race condition eliminated)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================
interface JobData {
  id: string;
  page_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  result?: unknown;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

interface ActiveJob {
  id: string;
  pageId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  result?: unknown;
  errorMessage?: string;
}

interface UseJobProgressOptions {
  pollingInterval?: number;
  onComplete?: (job: ActiveJob) => void;
  onError?: (job: ActiveJob) => void;
  onProgress?: (job: ActiveJob) => void;
}

interface UseJobProgressReturn {
  // State
  activeJob: ActiveJob | null;
  currentStepIndex: number;
  isRunning: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLoading: boolean;
  
  // Actions
  watchJob: (pageId: string) => Promise<void>;
  stopWatching: () => void;
  
  // Legacy compatibility
  job: ActiveJob | null;
  progress: number;
  currentStep: string;
  status: string;
  result: unknown;
  error: string | undefined;
}

// ============================================================================
// STEP INDEX CALCULATION
// Maps progress percentage to step index (0-5 scale)
// ============================================================================
function calculateStepIndex(progress: number): number {
  if (progress <= 0) return 0;
  if (progress < 15) return 0;  // Starting
  if (progress < 30) return 1;  // Fetching content
  if (progress < 50) return 2;  // Analyzing
  if (progress < 70) return 3;  // Generating
  if (progress < 90) return 4;  // Optimizing
  return 5;                      // Finalizing/Complete
}

// ============================================================================
// MAIN HOOK
// ============================================================================
export function useJobProgress(
  options: UseJobProgressOptions = {}
): UseJobProgressReturn {
  const { 
    pollingInterval = 500, 
    onComplete, 
    onError,
    onProgress 
  } = options;

  // State
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [watchingPageId, setWatchingPageId] = useState<string | null>(null);
  
  // Refs for cleanup and tracking
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);

  // ============================================================================
  // CLEANUP FUNCTION
  // ============================================================================
  const cleanup = useCallback(() => {
    console.log('[useJobProgress] Cleaning up...');
    activeRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ============================================================================
  // STOP WATCHING - Public method to stop job tracking
  // ============================================================================
  const stopWatching = useCallback(() => {
    console.log('[useJobProgress] Stop watching called');
    cleanup();
    setWatchingPageId(null);
    setIsLoading(false);
  }, [cleanup]);

  // ============================================================================
  // FETCH JOB STATUS - Core polling function
  // ============================================================================
  const fetchJobStatus = useCallback(async (pageId: string) => {
    if (!activeRef.current || !mountedRef.current) return;

    try {
      // Query for the latest job associated with this page
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[useJobProgress] Fetch error:', error);
        return;
      }

      if (!data || data.length === 0) {
        // No job found yet - might still be creating
        console.log('[useJobProgress] No job found for page:', pageId);
        return;
      }

      const jobData = data[0] as JobData;
      
      const job: ActiveJob = {
        id: jobData.id,
        pageId: jobData.page_id,
        status: jobData.status,
        progress: jobData.progress || 0,
        currentStep: jobData.current_step || 'Processing...',
        result: jobData.result,
        errorMessage: jobData.error_message,
      };

      if (mountedRef.current) {
        setActiveJob(job);
        onProgress?.(job);
      }

      // Handle completion
      if (jobData.status === 'completed') {
        console.log('[useJobProgress] Job completed:', jobData.id);
        cleanup();
        if (mountedRef.current) {
          setIsLoading(false);
          setWatchingPageId(null);
        }
        onComplete?.(job);
      }

      // Handle failure
      if (jobData.status === 'failed') {
        console.log('[useJobProgress] Job failed:', jobData.id, jobData.error_message);
        cleanup();
        if (mountedRef.current) {
          setIsLoading(false);
          setWatchingPageId(null);
        }
        onError?.(job);
      }

    } catch (err) {
      console.error('[useJobProgress] Exception:', err);
    }
  }, [cleanup, onComplete, onError, onProgress]);

  // ============================================================================
  // WATCH JOB - Public method to start tracking a job by page ID
  // ============================================================================
  const watchJob = useCallback(async (pageId: string) => {
    console.log('[useJobProgress] Watch job called for page:', pageId);
    
    // Clean up any existing polling
    cleanup();
    
    // Reset state
    setActiveJob(null);
    setIsLoading(true);
    setWatchingPageId(pageId);
    activeRef.current = true;

    // Initial fetch
    await fetchJobStatus(pageId);

  }, [cleanup, fetchJobStatus, pollingInterval]);

  // ============================================================================
  // EFFECT: Watch for pageId changes
  // ============================================================================
  useEffect(() => {
    if (watchingPageId) {
      activeRef.current = true;
      
      // Start polling
      pollRef.current = setInterval(() => {
        if (activeRef.current && mountedRef.current) {
          fetchJobStatus(watchingPageId);
        }
      }, pollingInterval);
    }

    return () => {
      // Don't cleanup on every effect run, only on unmount
    };
  }, [watchingPageId, pollingInterval, fetchJobStatus]);

  // ============================================================================
  // EFFECT: Cleanup on unmount
  // ============================================================================
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      console.log('[useJobProgress] Component unmounting, cleaning up...');
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  const currentStepIndex = calculateStepIndex(activeJob?.progress || 0);
  const isRunning = activeJob?.status === 'running';
  const isCompleted = activeJob?.status === 'completed';
  const isFailed = activeJob?.status === 'failed';

  // ============================================================================
  // RETURN VALUE
  // ============================================================================
  return {
    // Primary state
    activeJob,
    currentStepIndex,
    isRunning,
    isCompleted,
    isFailed,
    isLoading,
    
    // Actions
    watchJob,
    stopWatching,
    
    // Legacy compatibility (for components using old interface)
    job: activeJob,
    progress: activeJob?.progress || 0,
    currentStep: activeJob?.currentStep || '',
    status: activeJob?.status || 'pending',
    result: activeJob?.result,
    error: activeJob?.errorMessage,
  };
}

export default useJobProgress;
