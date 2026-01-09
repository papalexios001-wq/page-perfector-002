'use client';

import React, { useEffect, useState } from 'react';
import { ContentJob, JobStep } from '@/lib/pipeline/types';
import { Check, Loader2, AlertCircle, Zap } from 'lucide-react';

interface ProgressMonitorProps {
  job: ContentJob;
  isVisible: boolean;
}

/**
 * ENTERPRISE-GRADE REAL-TIME PROGRESS MONITOR
 * Displays multi-stage pipeline progress with visual feedback
 */
export function ProgressMonitor({ job, isVisible }: ProgressMonitorProps) {
  const [logMessages, setLogMessages] = useState<string[]>([]);

  useEffect(() => {
    if (job.steps) {
      const messages = job.steps
        .filter((s) => s.message && s.message !== 'Awaiting start')
        .map((s) => `[${s.id.toUpperCase()}] ${s.message}`);
      setLogMessages(messages);
    }
  }, [job]);

  if (!isVisible) return null;

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'running':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <Check className="w-4 h-4" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-2xl">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Content Optimization</h2>
          </div>
          <span className="text-xs font-mono bg-slate-700 px-3 py-1 rounded text-slate-300">
            {job.jobId.slice(0, 8)}
          </span>
        </div>

        {/* GLOBAL PROGRESS BAR */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300">Overall Progress</span>
            <span className="text-lg font-bold text-cyan-400">{job.progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500 ease-out shadow-lg shadow-cyan-500/50"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* STEP INDICATORS */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">PIPELINE STAGES</h3>
        <div className="grid grid-cols-3 gap-2">
          {job.steps.map((step, idx) => (
            <div key={step.id} className="flex flex-col">
              <div
                className={`p-3 rounded-lg border-2 transition-all duration-300 flex items-center gap-2 ${
                  getStepColor(step.status)
                }`}
              >
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <div className="text-xs font-bold truncate">{step.name}</div>
                  <div className="text-xs opacity-75">{step.progress}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CURRENT STEP DETAIL */}
      {job.steps.find((s) => s.status === 'running') && (
        <div className="mb-8 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-300">
                {job.steps.find((s) => s.status === 'running')?.name}
              </p>
              <p className="text-sm text-blue-200 mt-1">
                {job.steps.find((s) => s.status === 'running')?.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {job.state === 'failed' && (
        <div className="mb-8 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Optimization Failed</p>
            <p className="text-sm text-red-200 mt-1">{job.error}</p>
          </div>
        </div>
      )}

      {/* LIVE LOG */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">ACTIVITY LOG</h3>
        <div className="bg-black/40 border border-slate-700 rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto">
          {logMessages.length === 0 ? (
            <p className="text-slate-500">Waiting to start...</p>
          ) : (
            logMessages.slice(-15).map((msg, idx) => (
              <div key={idx} className="text-green-400 mb-1">
                <span className="text-slate-500">> </span>
                {msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-slate-200 capitalize">{job.state}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Mode</p>
          <p className="text-sm font-bold text-slate-200 capitalize">{job.mode}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Elapsed Time</p>
          <p className="text-sm font-bold text-slate-200">
            {job.startedAt
              ? Math.round(
                  (new Date().getTime() - job.startedAt.getTime()) / 1000
                ) + 's'
              : '-'}
          </p>
        </div>
      </div>
    </div>
  );
}
