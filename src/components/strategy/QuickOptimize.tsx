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

// Helper function to wait for store persistence
const waitForStorePersistence = (slug: string, maxWaitMs: number = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    
    const checkStore = () => {
      try {
        // Read directly from localStorage to verify persistence
        const storedData = localStorage.getItem('wp-optimizer-pages');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          const pages = parsed?.state?.pages || [];
          const page = pages.find((p: any) => p.slug === slug);
          
          if (page && page.optimizedContent) {
            console.log('[QuickOptimize] Store persistence verified for slug:', slug);
            resolve(true);
            return;
          }
        }
        
        // Check timeout
        if (Date.now() - startTime > maxWaitMs) {
          console.warn('[QuickOptimize] Store persistence timeout for slug:', slug);
          resolve(false);
          return;
        }
        
        // Keep checking
        setTimeout(checkStore, checkInterval);
      } catch (e) {
        console.error('[QuickOptimize] Error checking store persistence:', e);
        resolve(false);
      }
    };
    
    checkStore();
  });
};

export function QuickOptimize() {
  const { addPages, updatePage, addActivityLog, pages } = usePagesStore();
  const navigate = useNavigate();
  const [pageUrl, setPageUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [outputMode, setOutputMode] = useState<'draft' | 'publish'>('draft');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleOptimize = async () => {
    if (!pageUrl) {
      toast.error('Please enter a page URL');
      return;
    }

    setIsOptimizing(true);
    setProgress(0);
    setStatusMessage('Initializing optimization...');

    try {
      // Create page record - normalize the slug
      const pageSlug = pageUrl.replace(/^\/+/, '').replace(/\/+$/, '').trim();
      
      if (!pageSlug) {
        throw new Error('Invalid page URL');
      }
      
      const pageId = Math.random().toString(36).substring(2, 15);
      const newPage = {
        id: pageId,
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

      console.log('[QuickOptimize] Creating page record:', newPage);
      addPages([newPage]);
      
      addActivityLog({
        type: 'info',
        pageUrl,
        message: 'Quick optimization started',
        details: { keyword: targetKeyword || 'auto-detect', outputMode },
      });

      // Simulate progress updates with status messages
      setStatusMessage('Analyzing content structure...');
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = Math.min(prev + 8, 85);
          if (newProgress > 30 && newProgress <= 50) {
            setStatusMessage('Generating optimized content...');
          } else if (newProgress > 50 && newProgress <= 70) {
            setStatusMessage('Applying SEO enhancements...');
          } else if (newProgress > 70) {
            setStatusMessage('Finalizing blog post...');
          }
          return newProgress;
        });
      }, 400);

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

      if (error) {
        console.error('[QuickOptimize] Optimization error:', error);
        throw new Error(error.message || 'Optimization failed');
      }

      if (!data || !data.result) {
        console.error('[QuickOptimize] No result in response:', data);
        throw new Error('No optimization result received');
      }

      console.log('[QuickOptimize] Optimization successful:', data);
      setProgress(90);
      setStatusMessage('Saving optimized content...');

      // CRITICAL: Stringify the result for storage
      const optimizedContentString = JSON.stringify(data.result);
      
      // Update page with optimized content
      updatePage(pageId, {
        status: 'completed',
        optimizedAt: new Date().toISOString(),
        optimizedContent: optimizedContentString,
        title: data.result.title || newPage.title,
      });

      console.log('[QuickOptimize] Page updated with optimized content');

      // Wait for store persistence before navigation
      setProgress(95);
      setStatusMessage('Preparing preview...');
      
      const persisted = await waitForStorePersistence(pageSlug, 3000);
      
      if (!persisted) {
        console.warn('[QuickOptimize] Store persistence not confirmed, proceeding anyway');
      }

      setProgress(100);
      setStatusMessage('Complete!');

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
      // Use a small delay to ensure UI updates
      setTimeout(() => {
        console.log('[QuickOptimize] Navigating to:', `/blog/${pageSlug}`);
        navigate(`/blog/${pageSlug}`);
      }, 300);

    } catch (err: any) {
      console.error('[QuickOptimize] Error:', err);
      setStatusMessage('Optimization failed');
      
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
      setStatusMessage('');
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
              <span>{statusMessage || 'Optimizing...'}</span>
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
