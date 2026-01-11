import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Target, FileText, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePagesStore } from '@/stores/pages-store';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

export function QuickOptimize() {
  const { addPages, updatePage, addActivityLog } = usePagesStore();
  const navigate = useNavigate();
  const [pageUrl, setPageUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [outputMode, setOutputMode] = useState<'draft' | 'publish'>('draft');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleOptimize = async () => {
    if (!pageUrl) {
      toast.error('Please enter a page URL');
      return;
    }

    setIsOptimizing(true);
    setProgress(0);

    try {
      // Create page record
      const pageSlug = pageUrl.replace(/^\//, '');
      const newPage = {
        id: Math.random().toString(36).substring(2, 15),
        url: pageUrl,
        slug: pageSlug,
        title: `Page: ${pageUrl}`,
        wordCount: 0,
        status: 'analyzing' as const,
        postType: 'post',
        categories: [],
        tags: [],
        retryCount: 0,
      };

      addPages([newPage]);
      addActivityLog({
        type: 'info',
        pageUrl,
        message: 'Quick optimization started',
        details: { keyword: targetKeyword || 'auto-detect', outputMode },
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      // Call the REAL optimization Edge Function
      console.log('[QuickOptimize] Calling optimize-content Edge Function');
      const { data, error } = await invokeEdgeFunction({
        functionName: 'optimize-content',
        body: {
          pageUrl: pageUrl,
          targetKeyword: targetKeyword || null,
          outputMode: outputMode,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        console.error('[QuickOptimize] Optimization error:', error);
        throw new Error(error.message || 'Optimization failed');
      }

      if (!data || !data.result) {
        console.error('[QuickOptimize] No result in response:', data);
        throw new Error('No optimization result received');
      }

      console.log('[QuickOptimize] Optimization successful:', data);

      // Update page with optimized content
      updatePage(newPage.id, {
        status: 'completed',
        optimizedAt: new Date().toISOString(),
        optimizedContent: JSON.stringify(data.result),
        title: data.result.title || newPage.title,
      });

      addActivityLog({
        type: 'success',
        pageUrl,
        message: 'Optimization completed successfully',
        details: { keyword: targetKeyword || 'auto-detected', outputMode },
      });

      toast.success('Optimization Complete!', {
        description: `Successfully optimized ${pageUrl}`,
      });

      // Clear form
      setPageUrl('');
      setTargetKeyword('');

      // Navigate to the optimized blog post page
      setTimeout(() => {
        console.log('[QuickOptimize] Navigating to:', `/category/:slug/${pageSlug}`);
        navigate(`/category/:slug/${pageSlug}`);
      }, 500);

    } catch (err: any) {
      console.error('[QuickOptimize] Error:', err);
      
      addActivityLog({
        type: 'error',
        pageUrl,
        message: `Optimization failed: ${err.message}`,
      });

      toast.error('Optimization Failed', {
        description: err.message || 'An unexpected error occurred',
      });
    } finally {
      setIsOptimizing(false);
      setProgress(0);
    }
  };

  return (
    <Card className="glass-panel border-border/50 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Optimize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Page URL *</Label>
          <Input
            placeholder="/your-page"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            className="bg-muted/50"
            disabled={isOptimizing}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Target Keyword</Label>
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="(auto-detect)"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              className="bg-muted/50 pl-10"
              disabled={isOptimizing}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Output Mode</Label>
          <RadioGroup
            value={outputMode}
            onValueChange={(v) => setOutputMode(v as 'draft' | 'publish')}
            className="flex gap-2"
            disabled={isOptimizing}
          >
            <div className="flex-1">
              <RadioGroupItem value="draft" id="draft" className="peer sr-only" />
              <label
                htmlFor="draft"
                className="flex items-center justify-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">Draft</span>
              </label>
            </div>
            <div className="flex-1">
              <RadioGroupItem value="publish" id="publish" className="peer sr-only" />
              <label
                htmlFor="publish"
                className="flex items-center justify-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-all"
              >
                <Send className="w-4 h-4" />
                <span className="text-sm">Publish</span>
              </label>
            </div>
          </RadioGroup>
        </div>

        {isOptimizing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Optimizing...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleOptimize}
          disabled={isOptimizing || !pageUrl}
          className="w-full gap-2"
          variant="default"
        >
          {isOptimizing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isOptimizing ? 'Optimizing...' : 'Optimize Now'}
        </Button>
      </CardContent>
    </Card>
  );
}
