// src/components/pipeline/ResultsModal.tsx
// ============================================================================
// RESULTS MODAL - Shows optimization results with publish options
// ============================================================================

import React, { useState } from 'react';
import { X, Copy, Download, Send, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  pageId: string;
}

export function ResultsModal({ isOpen, onClose, result, pageId }: ResultsModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'draft' | 'published'>('idle');

  if (!isOpen || !result) return null;

  const handlePublish = async (status: 'draft' | 'publish') => {
    setIsPublishing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('publish-to-wordpress', {
        body: {
          pageId: pageId,
          title: result.title || result.optimizedTitle || 'Optimized Post',
          content: result.optimizedContent || '',
          status: status,
        },
      });

      if (error) {
        throw new Error(error.message || 'Publish failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Publish failed');
      }

      setPublishStatus(status === 'publish' ? 'published' : 'draft');
      toast.success(status === 'publish' ? 'Published successfully!' : 'Saved as draft!');

    } catch (err) {
      console.error('[Publish] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyContent = () => {
    const content = result.optimizedContent || '';
    navigator.clipboard.writeText(content);
    toast.success('Content copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Optimization Results</h2>
              <p className="text-blue-100 mt-1">{result.title || 'Optimized Content'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Metrics */}
          <div className="flex gap-4 mt-4">
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              Quality: {result.qualityScore || 'N/A'}/100
            </Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              SEO: {result.seoScore || 'N/A'}/100
            </Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              Words: {result.wordCount || 'N/A'}
            </Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              Sections: {result.sections?.length || 0}
            </Badge>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: result.optimizedContent || '<p>No content generated</p>' }}
          />
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopyContent}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy HTML
              </Button>
            </div>

            <div className="flex gap-2">
              {publishStatus === 'idle' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handlePublish('draft')}
                    disabled={isPublishing}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {isPublishing ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  <Button
                    onClick={() => handlePublish('publish')}
                    disabled={isPublishing}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isPublishing ? 'Publishing...' : 'Publish Now'}
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">
                    {publishStatus === 'published' ? 'Published!' : 'Saved as Draft!'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResultsModal;
