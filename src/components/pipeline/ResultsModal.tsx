'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check, X, TrendingUp } from 'lucide-react';
import { OptimizationResult } from './QuickOptimizeButton';

interface ResultsModalProps {
  result: OptimizationResult;
  isOpen: boolean;
  onClose: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  result,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'seo' | 'recommendations'>('overview');

  const handleCopy = () => {
    navigator.clipboard.writeText(result.enhanced.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([result.enhanced.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'optimized-content.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const renderMetricCard = (label: string, original: number, enhanced: number, icon: string) => {
    const improvement = enhanced - original;
    const improvementPercent = ((improvement / Math.max(1, original)) * 100).toFixed(1);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-gray-400 line-through text-sm">{original.toFixed(1)}</span>
          <span className="text-2xl font-bold text-gray-900">{enhanced.toFixed(1)}</span>
        </div>
        {improvement > 0 && (
          <div className="flex items-center gap-1 text-green-600 font-semibold">
            <TrendingUp size={16} />
            <span>+{improvement.toFixed(1)}</span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-6 sm:px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">\u2728</span>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Optimization Complete</h2>
                    <p className="text-blue-100 text-sm">SOTA enhanced your content</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={onClose}
                  className="text-white hover:bg-white/20 rounded-lg p-2"
                >
                  <X size={24} />
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Score</h3>
                  <div className="text-4xl font-bold text-green-600">+{Math.round(result.improvements.overall)} points</div>
                </motion.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderMetricCard('Readability', result.original.metrics.readability, result.enhanced.metrics.readability, '📖')}
                  {renderMetricCard('SEO', result.original.metrics.seoScore, result.enhanced.metrics.seoScore, '🔍')}
                </div>
              </div>
              <div className="border-t border-gray-200 bg-gray-50 px-6 sm:px-8 py-4 flex gap-3 justify-end">
                <motion.button whileHover={{ scale: 1.05 }} onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium">
                  Close
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy'}
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                  <Download size={18} />
                  Download
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ResultsModal;
