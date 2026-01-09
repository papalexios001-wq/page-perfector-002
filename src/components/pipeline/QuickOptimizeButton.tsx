'use client';

import React, { useState, useCallback } from 'react';
import { Zap, Loader2, Check, AlertCircle } from 'lucide-react';
import { progressManager } from '@/lib/pipeline/progress-manager';

interface QuickOptimizeButtonProps {
  url: string;
  onJobStart?: (jobId: string) => void;
  onJobComplete?: (jobId: string) => void;
}

/**
 * THUNDER ICON - Quick Optimize Button
 * Instantly starts URL optimization with idempotent job management
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

  const handleOptimize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsComplete(false);

      // Generate idempotent job ID
      const newJobId = `optimize_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setJobId(newJobId);

      // Create job in progress manager
      const job = progressManager.createJob(newJobId, 'default', 'optimize', url);

      onJobStart?.(newJobId);

      // Simulate API call (replace with actual endpoint)
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, jobId: newJobId }),
      });

      if (!response.ok) throw new Error('Optimization failed');

      setIsComplete(true);
      onJobComplete?.(newJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      progressManager.failJob(jobId || '', 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [url, onJobStart, onJobComplete, jobId]);

  const getButtonState = () => {
    if (isLoading) return { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Optimizing...', color: 'bg-blue-500' };
    if (isComplete) return { icon: <Check className="w-4 h-4" />, label: 'Complete', color: 'bg-green-500' };
    if (error) return { icon: <AlertCircle className="w-4 h-4" />, label: 'Error', color: 'bg-red-500' };
    return { icon: <Zap className="w-4 h-4" />, label: 'Optimize', color: 'bg-amber-500 hover:bg-amber-600' };
  };

  const state = getButtonState();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleOptimize}
        disabled={isLoading}
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
  );
}
