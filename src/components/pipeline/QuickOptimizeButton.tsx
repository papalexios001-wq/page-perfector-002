// src/components/pipeline/QuickOptimizeButton.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Zap, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QuickOptimizeButtonProps {
  url: string;
  title?: string;
  disabled?: boolean;
  onComplete?: (result: any) => void;
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
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const startTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const stopPolling = () => {
    isPollingRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  };

  const pollJobStatus = async (id: string) => {
    if (!isPollingRef.current) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('[Poll] Error:', fetchError);
        return;
      }

      if (!data) return;

      // Update progress
      setProgress(data.progress || 0);
      setCurrentStep(data.current_step || 'Processing...');

      // Check if completed
      if (data.status === 'completed') {
        console.log('[Poll] Completed!');
        stopPolling();
        setIsOptimizing(false);
        setResult(data.result);
        setShowResults(true);
        toast.success('Optimization complete!');
        if (onComplete) onComplete(data.result);
      }

      // Check if failed
      if (data.status === 'failed') {
        console.error('[Poll] Failed:', data.error_message);
        stopPolling();
        setIsOptimizing(false);
        setError(data.error_message || 'Optimization failed');
        toast.error(data.error_message || 'Optimization failed');
      }
    } catch (err) {
      console.error('[Poll] Exception:', err);
    }
  };

  const handleOptimize = async () => {
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    // Reset state
    setIsOptimizing(true);
    setProgress(0);
    setCurrentStep('Starting...');
    setError(null);
    setResult(null);
    setShowResults(false);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    // Start timer
    timeIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      console.log('[Optimize] Starting for:', url);

      // Call Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke(
        'optimize-content',
        {
          body: { url, postTitle: title || url }
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to start');
      }

      if (!data || !data.success || !data.jobId) {
        throw new Error(data?.error || 'Invalid response');
      }

      console.log('[Optimize] Job created:', data.jobId);
      setJobId(data.jobId);

      // Start polling
      isPollingRef.current = true;
      pollJobStatus(data.jobId); // Initial poll
      
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(data.jobId);
      }, 1000);

    } catch (err: any) {
      console.error('[Optimize] Error:', err);
      stopPolling();
      setIsOptimizing(false);
      setError(err.message || 'Failed to start');
      toast.error(err.message || 'Failed to start');
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const handleCancel = () => {
    stopPolling();
    setIsOptimizing(false);
    toast.info('Cancelled');
  };

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
            content: result.optimizedContent || '',
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
      setShowResults(false);

    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Publish failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Button */}
      {!isOptimizing && !result && (
        <Button
          onClick={handleOptimize}
          disabled={disabled || !url}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3"
        >
          <Zap className="w-5 h-5 mr-2" />
          Quick Optimize
        </Button>
      )}

      {/* Progress UI */}
      {isOptimizing && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-4">
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

          <Button variant="outline" size="sm" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {/* Error */}
      {error && !isOptimizing && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Failed</span>
          </div>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={handleOptimize} className="mt-3">
            Retry
          </Button>
        </div>
      )}

      {/* Results */}
      {showResults && result && (
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Complete!</span>
          </div>
          <div className="mt-2 flex gap-2">
            <Badge>Score: {result.qualityScore || 'N/A'}</Badge>
            <Badge>Words: {result.wordCount || 'N/A'}</Badge>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handlePublish('draft')}>
              Save Draft
            </Button>
            <Button size="sm" onClick={() => handlePublish('publish')}>
              Publish
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setResult(null); setShowResults(false); setError(null); }}
            className="mt-2 w-full"
          >
            Optimize Another
          </Button>
        </div>
      )}
    </div>
  );
}

export default QuickOptimizeButton;
