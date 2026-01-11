import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  List, Search, Filter, Zap, Eye, Trash2, RotateCcw, FileText, 
  ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle2, 
  XCircle, Upload, Send, AlertTriangle, Info, CheckCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreIndicator } from '@/components/shared/ScoreIndicator';
import { OptimizationProgress, DEFAULT_STEPS, OptimizationStep } from './OptimizationProgress';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase';
import { useConfigStore } from '@/stores/config-store';
import { useJobProgress } from '@/hooks/useJobProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

interface DBPage {
  id: string;
  url: string;
  slug: string;
  title: string;
  word_count: number | null;
  status: string | null;
  score_before: unknown;
  score_after: unknown;
  post_id: number | null;
  post_type: string | null;
  categories: string[] | null;
  tags: string[] | null;
  featured_image: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OptimizationResult {
  optimizedTitle?: string;
  metaDescription?: string;
  h1?: string;
  h2s?: string[];
  optimizedContent?: string;
  tldrSummary?: string[];
  expertQuote?: { quote: string; author: string; role: string };
  youtubeEmbed?: { searchQuery: string; suggestedTitle: string; context: string };
  patentReference?: { type: string; identifier: string; title: string; summary: string; link: string };
  faqs?: Array<{ question: string; answer: string }>;
  keyTakeaways?: string[];
  contentStrategy?: {
    wordCount?: number;
    readabilityScore?: number;
    keywordDensity?: number;
    lsiKeywords?: string[];
  };
  internalLinks?: Array<{ anchor: string; target: string; position: number }>;
  schema?: Record<string, unknown>;
  aiSuggestions?: {
    contentGaps?: string;
    quickWins?: string;
    improvements?: string[];
  };
  qualityScore?: number;
  seoScore?: number;
  readabilityScore?: number;
  engagementScore?: number;
  estimatedRankPosition?: number;
  confidenceLevel?: number;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  actual: string | number;
  expected: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  success: boolean;
  canPublish: boolean;
  overallScore: number;
  checks: ValidationCheck[];
  summary: { errors: number; warnings: number; passed: number };
}

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
  status: 'idle' | 'running' | 'complete' | 'error';
}

// ============================================================================
// SAFE DATA ACCESS HELPERS
// ============================================================================
function safeGetArray<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

function safeGetNumber(val: number | undefined | null, defaultVal: number = 0): number {
  return typeof val === 'number' ? val : defaultVal;
}

function safeGetString(val: string | undefined | null, defaultVal: string = ''): string {
  return typeof val === 'string' ? val : defaultVal;
}

export function PageQueue() {
  const [pages, setPages] = useState<DBPage[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Progress bar state
  const [optimizationSteps, setOptimizationSteps] = useState<OptimizationStep[]>(DEFAULT_STEPS);
  const [optimizingPageTitle, setOptimizingPageTitle] = useState<string>('');
  
  // Batch optimization state
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    current: '',
    status: 'idle',
  });
  
  // Dialog states
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedPageResult, setSelectedPageResult] = useState<{ page: DBPage; result: OptimizationResult | null } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number; status: string }>({ current: 0, total: 0, status: '' });
  
  const { wordpress, ai, neuronWriter, optimization: optimizationSettings, advanced, siteContext } = useConfigStore();

  // ============================================================================
  // FIX: Use ref to always have access to fresh pages data in callbacks
  // ============================================================================
  const pagesRef = useRef<DBPage[]>([]);
  const batchProgressRef = useRef<BatchProgress>(batchProgress);

  // Keep refs in sync with state
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    batchProgressRef.current = batchProgress;
  }, [batchProgress]);

  // ============================================================================
  // SAFE onComplete handler with error boundary
  // ============================================================================
  const handleJobComplete = useCallback(async (job: any) => {
    console.log('[PageQueue] Job completed:', job);
    
    try {
      // For single optimization, show result dialog
      if (batchProgressRef.current.status === 'idle') {
        setIsOptimizing(false);
        setOptimizingPageTitle('');
        
        // Fetch fresh pages data
        await fetchPages();
        
        // Use ref to get fresh pages data
        const freshPages = pagesRef.current;
        
        if (job?.result) {
          const pageToShow = freshPages.find(p => p.id === job.pageId);
          
          if (pageToShow) {
            // Safely cast and validate the result
            const optimization = job.result as OptimizationResult;
            
            setSelectedPageResult({ page: pageToShow, result: optimization });
            setShowResultDialog(true);
            
            // Safe access to properties
            const qualityScore = safeGetNumber(optimization?.qualityScore, 0);
            const wordCount = safeGetNumber(optimization?.contentStrategy?.wordCount, 0);
            
            toast.success('Page optimized successfully!', {
              description: `Quality score: ${qualityScore}/100, Words: ${wordCount || 'N/A'}`,
            });
          } else {
            console.warn('[PageQueue] Could not find page after optimization:', job.pageId);
            toast.success('Optimization completed!', {
              description: 'Refresh the page to see results.',
            });
          }
        } else {
          toast.success('Optimization completed!');
        }
      }
    } catch (error) {
      console.error('[PageQueue] Error in onComplete handler:', error);
      setIsOptimizing(false);
      setOptimizingPageTitle('');
      toast.success('Optimization completed!', {
        description: 'Check the results in the table.',
      });
    }
  }, []);

  const handleJobError = useCallback(async (job: any) => {
    console.log('[PageQueue] Job failed:', job);
    
    try {
      if (batchProgressRef.current.status === 'idle') {
        setIsOptimizing(false);
        setOptimizingPageTitle('');
        await fetchPages();
        toast.error('Optimization failed', {
          description: job?.errorMessage || 'Check the console for details.',
        });
      }
    } catch (error) {
      console.error('[PageQueue] Error in onError handler:', error);
      setIsOptimizing(false);
      setOptimizingPageTitle('');
    }
  }, []);

  // Real-time job progress hook
  const { 
    activeJob, 
    currentStepIndex, 
    watchJob, 
    stopWatching, 
    isRunning: jobIsRunning,
    isCompleted: jobIsCompleted,
    isFailed: jobIsFailed
  } = useJobProgress({
    onComplete: handleJobComplete,
    onError: handleJobError,
  });

  // Update step visualization based on real job progress
  useEffect(() => {
    if (activeJob && jobIsRunning) {
      setOptimizationSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i < currentStepIndex ? 'completed' : i === currentStepIndex ? 'active' : 'pending'
      })));
    }
  }, [activeJob, currentStepIndex, jobIsRunning]);

  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const fetchedPages = data || [];
      setPages(fetchedPages);
      pagesRef.current = fetchedPages; // Update ref immediately
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to load pages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const togglePageSelection = (id: string) => {
    setSelectedPages(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = paginatedPages.map(p => p.id);
    const allSelected = visibleIds.every(id => selectedPages.includes(id));
    if (allSelected) {
      setSelectedPages(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedPages(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Start async optimization job
  const startOptimizationJob = useCallback(async (
    pageId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> => {
    if (!wordpress.siteUrl || !wordpress.username || !wordpress.applicationPassword) {
      return { success: false, error: 'WordPress not configured' };
    }

    const aiConfigPayload = ai.apiKey && ai.model && ai.provider ? {
      provider: ai.provider,
      apiKey: ai.apiKey,
      model: ai.model,
    } : undefined;

    const neuronWriterPayload = neuronWriter.enabled && neuronWriter.isValidated && neuronWriter.apiKey && neuronWriter.selectedProjectId ? {
      enabled: true,
      apiKey: neuronWriter.apiKey,
      projectId: neuronWriter.selectedProjectId,
      projectName: neuronWriter.selectedProjectName,
    } : undefined;

    try {
      const { data, error } = await invokeEdgeFunction<{
        success: boolean;
        message: string;
        jobId?: string;
        optimization?: OptimizationResult;
        error?: string;
      }>('optimize-content', {
        pageId,
        siteUrl: wordpress.siteUrl,
        username: wordpress.username,
        applicationPassword: wordpress.applicationPassword,
        aiConfig: aiConfigPayload,
        neuronWriter: neuronWriterPayload,
        advanced: {
          targetScore: advanced.targetScore,
          minWordCount: advanced.minWordCount,
          maxWordCount: advanced.maxWordCount,
          enableFaqs: advanced.enableFaqs,
          enableSchema: advanced.enableSchema,
          enableInternalLinks: advanced.enableInternalLinks,
          enableToc: advanced.enableToc,
          enableKeyTakeaways: advanced.enableKeyTakeaways,
          enableCtas: advanced.enableCtas,
        },
        siteContext: {
          organizationName: siteContext.organizationName,
          industry: siteContext.industry,
          targetAudience: siteContext.targetAudience,
          brandVoice: siteContext.brandVoice,
        },
      });

      if (error) {
        console.error(`[Optimize] Error for ${pageId}:`, error);
        return { success: false, error: error.message };
      }

      return { 
        success: data?.success || false, 
        jobId: data?.jobId,
        error: data?.error 
      };
    } catch (err) {
      console.error(`[Optimize] Exception for ${pageId}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [wordpress, ai, neuronWriter, advanced, siteContext]);

  // Wait for a job to complete by polling the database
  const waitForJobCompletion = async (pageId: string, jobId: string, timeoutMs: number = 600000): Promise<{ success: boolean; error?: string }> => {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const { data: jobData, error } = await supabase
          .from('jobs')
          .select('status, error_message, result')
          .eq('id', jobId)
          .single();

        if (error) {
          console.error(`[WaitForJob] Error polling job ${jobId}:`, error);
          return { success: false, error: error.message };
        }

        if (jobData?.status === 'completed') {
          return { success: true };
        }

        if (jobData?.status === 'failed') {
          return { success: false, error: jobData.error_message || 'Job failed' };
        }
      } catch (err) {
        console.error(`[WaitForJob] Exception polling job ${jobId}:`, err);
      }

      // Wait before next poll
      await new Promise(r => setTimeout(r, pollInterval));
    }

    return { success: false, error: 'Job timed out after 10 minutes' };
  };

  const validateWordPressConnection = useCallback(async (): Promise<{ valid: boolean; error?: string }> => {
    const { siteUrl, username, applicationPassword } = wordpress;
    
    if (!siteUrl || !username || !applicationPassword) {
      return { valid: false, error: 'WordPress credentials missing. Go to Configuration tab.' };
    }

    try {
      let normalizedUrl = siteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      normalizedUrl = normalizedUrl.replace(/\/+$/, '');

      const credentials = `${username}:${applicationPassword}`;
      const authHeader = 'Basic ' + btoa(credentials);

      const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/posts?per_page=1`, {
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'WP-Perfector/1.0',
        },
      });

      if (response.status === 401) {
        return { valid: false, error: 'Invalid WordPress credentials' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'User lacks permissions (edit_posts required)' };
      }
      if (!response.ok) {
        return { valid: false, error: `WordPress API error: ${response.status}` };
      }

      return { valid: true };
    } catch (err) {
      return { 
        valid: false, 
        error: `Cannot connect to WordPress: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }, [wordpress]);

  // ============================================================
  // BATCH OPTIMIZATION - Process pages sequentially
  // ============================================================
  const handleOptimizeSelected = async () => {
    if (selectedPages.length === 0) {
      toast.error('Please select pages to optimize');
      return;
    }

    // Validate WordPress connection first
    toast.loading('Validating WordPress connection...');
    const wpValidation = await validateWordPressConnection();
    if (!wpValidation.valid) {
      toast.dismiss();
      toast.error('WordPress Connection Failed', {
        description: wpValidation.error,
      });
      return;
    }
    toast.dismiss();

    // Get pages to optimize
    const pagesToOptimize = pages.filter(p => selectedPages.includes(p.id));
    
    // Initialize batch progress
    const initialBatchProgress: BatchProgress = {
      total: pagesToOptimize.length,
      completed: 0,
      failed: 0,
      current: pagesToOptimize[0]?.title || pagesToOptimize[0]?.slug || 'Unknown',
      status: 'running',
    };
    setBatchProgress(initialBatchProgress);
    batchProgressRef.current = initialBatchProgress;
    setShowBatchDialog(true);
    setIsOptimizing(true);

    let successCount = 0;
    let errorCount = 0;

    // Process pages SEQUENTIALLY with proper tracking
    for (let i = 0; i < pagesToOptimize.length; i++) {
      const page = pagesToOptimize[i];
      
      // Update batch progress
      setBatchProgress(prev => {
        const updated = {
          ...prev,
          current: page.title || page.slug || 'Unknown',
          completed: i,
        };
        batchProgressRef.current = updated;
        return updated;
      });

      // Update page status in UI
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'optimizing' } : p));

      console.log(`[Batch] Starting optimization ${i + 1}/${pagesToOptimize.length}: ${page.slug}`);

      // Start the job
      const { success: jobStarted, jobId, error: startError } = await startOptimizationJob(page.id);

      if (!jobStarted || !jobId) {
        console.error(`[Batch] Failed to start job for ${page.slug}:`, startError);
        errorCount++;
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'failed' } : p));
        setBatchProgress(prev => {
          const updated = { ...prev, failed: prev.failed + 1 };
          batchProgressRef.current = updated;
          return updated;
        });
        continue;
      }

      // Wait for the job to complete (with timeout)
      const { success: jobCompleted, error: jobError } = await waitForJobCompletion(page.id, jobId);

      if (jobCompleted) {
        console.log(`[Batch] Job completed for ${page.slug}`);
        successCount++;
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'completed' } : p));
      } else {
        console.error(`[Batch] Job failed for ${page.slug}:`, jobError);
        errorCount++;
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'failed' } : p));
        setBatchProgress(prev => {
          const updated = { ...prev, failed: prev.failed + 1 };
          batchProgressRef.current = updated;
          return updated;
        });
      }

      // Small delay between jobs to avoid rate limiting
      if (i < pagesToOptimize.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Complete batch
    const finalProgress: BatchProgress = {
      total: pagesToOptimize.length,
      completed: pagesToOptimize.length,
      failed: errorCount,
      current: '',
      status: errorCount === pagesToOptimize.length ? 'error' : 'complete',
    };
    setBatchProgress(finalProgress);
    batchProgressRef.current = finalProgress;

    // Refresh pages and cleanup
    await fetchPages();
    setIsOptimizing(false);
    setSelectedPages([]);

    // Show summary toast
    setTimeout(() => {
      setShowBatchDialog(false);
      const idleProgress: BatchProgress = { total: 0, completed: 0, failed: 0, current: '', status: 'idle' };
      setBatchProgress(idleProgress);
      batchProgressRef.current = idleProgress;
      
      if (successCount > 0 && errorCount === 0) {
        toast.success(`Successfully optimized ${successCount} pages!`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`Completed: ${successCount} optimized, ${errorCount} failed`);
      } else {
        toast.error(`All ${errorCount} pages failed to optimize`);
      }
    }, 1500);
  };

  const handleOptimizeSingle = async (pageId: string) => {
    try {
      setOptimizationSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
      
      const wpValidation = await validateWordPressConnection();
      if (!wpValidation.valid) {
        toast.error('WordPress Connection Failed', {
          description: wpValidation.error,
        });
        return;
      }

      const pageToOptimize = pages.find(p => p.id === pageId);
      if (!pageToOptimize) {
        toast.error('Page not found');
        return;
      }

      setIsOptimizing(true);
      setOptimizingPageTitle(pageToOptimize.title || pageToOptimize.slug || 'Unknown page');
      
      setPages(prev => prev.map(p => p.id === pageId ? { ...p, status: 'optimizing' } : p));

      // Start watching for real-time job updates
      await watchJob(pageId);

      // Start the async job
      const { success, error } = await startOptimizationJob(pageId);
      
      if (!success) {
        setIsOptimizing(false);
        setOptimizingPageTitle('');
        await stopWatching();
        await fetchPages();
        toast.error('Failed to start optimization', {
          description: error || 'Check the console for details.',
        });
      }
    } catch (err) {
      console.error('[handleOptimizeSingle] Error:', err);
      setIsOptimizing(false);
      setOptimizingPageTitle('');
      toast.error('An error occurred', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleViewResult = async (page: DBPage) => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('result')
        .eq('page_id', page.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);

      if (jobError) {
        console.error('[ViewResult] Database error:', jobError);
        toast.error('Failed to load optimization result');
        return;
      }

      const result = jobData && jobData.length > 0 
        ? (jobData[0].result as unknown as OptimizationResult | null)
        : null;
        
      if (!result) {
        toast.warning('No optimization result found', {
          description: 'Run optimization first before viewing results.',
        });
      }
      
      setSelectedPageResult({ page, result });
      setShowResultDialog(true);
    } catch (err) {
      console.error('[handleViewResult] Error:', err);
      toast.error('Failed to load result');
    }
  };

  const validateOptimization = async (optimization: OptimizationResult): Promise<ValidationResult | null> => {
    try {
      const { data, error } = await invokeEdgeFunction<ValidationResult>('validate-content', {
        optimization,
        minQualityScore: 75,
      });

      if (error) {
        console.error('[Validate] Error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[validateOptimization] Error:', err);
      return null;
    }
  };

  const publishToWordPress = async (
    pageId: string, 
    optimization: OptimizationResult,
    publishStatus: 'draft' | 'publish' = 'draft'
  ): Promise<{ success: boolean; error?: string; postUrl?: string }> => {
    if (!wordpress.siteUrl || !wordpress.username || !wordpress.applicationPassword) {
      return { success: false, error: 'WordPress not configured' };
    }

    try {
      const { data, error } = await invokeEdgeFunction<{
        success: boolean;
        message: string;
        error?: string;
        postUrl?: string;
      }>('publish-to-wordpress', {
        pageId,
        siteUrl: wordpress.siteUrl,
        username: wordpress.username,
        applicationPassword: wordpress.applicationPassword,
        publishStatus,
        optimization: {
          optimizedTitle: optimization.optimizedTitle,
          metaDescription: optimization.metaDescription,
          h1: optimization.h1,
          h2s: optimization.h2s,
          optimizedContent: optimization.optimizedContent,
          schema: optimization.schema,
          internalLinks: optimization.internalLinks,
        },
        options: {
          preserveCategories: optimizationSettings.preserveCategories,
          preserveTags: optimizationSettings.preserveTags,
          preserveSlug: optimizationSettings.preserveSlug,
          preserveFeaturedImage: optimizationSettings.preserveFeaturedImage,
          updateYoast: true,
          updateRankMath: true,
        },
      });

      if (error) {
        console.error(`[Publish] Network error for ${pageId}:`, error);
        return { success: false, error: error.message || 'Network error' };
      }

      if (!data?.success) {
        console.error(`[Publish] API error for ${pageId}:`, data?.error || data?.message);
        return { success: false, error: data?.error || data?.message || 'Unknown error' };
      }

      return { success: true, postUrl: data.postUrl };
    } catch (err) {
      console.error(`[publishToWordPress] Exception for ${pageId}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const handleValidateAndPublish = async () => {
    if (!selectedPageResult?.result) return;

    const validation = await validateOptimization(selectedPageResult.result);
    setValidationResult(validation);
    setShowValidationDialog(true);
  };

  const handlePublishSingle = async (publishStatus: 'draft' | 'publish') => {
    if (!selectedPageResult?.result) return;

    setIsPublishing(true);
    const result = await publishToWordPress(
      selectedPageResult.page.id,
      selectedPageResult.result,
      publishStatus
    );
    setIsPublishing(false);

    if (result.success) {
      toast.success(`Published as ${publishStatus}!`, {
        description: result.postUrl ? `View: ${result.postUrl}` : undefined,
      });
      setShowValidationDialog(false);
      setShowResultDialog(false);
      await fetchPages();
    } else {
      toast.error('Publish failed', {
        description: result.error || 'Check console for details',
      });
    }
  };

  const handlePublishSelected = async (publishStatus: 'draft' | 'publish') => {
    const completedPages = pages.filter(
      p => selectedPages.includes(p.id) && p.status === 'completed'
    );

    if (completedPages.length === 0) {
      toast.error('No completed pages selected', {
        description: 'Only optimized pages can be published.',
      });
      return;
    }

    setShowPublishDialog(true);
    setIsPublishing(true);
    setPublishProgress({ current: 0, total: completedPages.length, status: 'Starting...' });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < completedPages.length; i++) {
      const page = completedPages[i];
      setPublishProgress({ 
        current: i + 1, 
        total: completedPages.length, 
        status: `Publishing: ${page.slug || page.title}` 
      });

      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('result')
          .eq('page_id', page.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1);

        if (jobError || !jobData || jobData.length === 0) {
          errorCount++;
          continue;
        }

        const optimization = jobData[0]?.result as unknown as OptimizationResult | null;

        if (!optimization) {
          errorCount++;
          continue;
        }

        const result = await publishToWordPress(page.id, optimization, publishStatus);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }

      await new Promise(r => setTimeout(r, 300));
    }

    setIsPublishing(false);
    setShowPublishDialog(false);
    setSelectedPages([]);
    await fetchPages();

    if (successCount > 0 && errorCount === 0) {
      toast.success(`Published ${successCount} pages as ${publishStatus}!`);
    } else if (successCount > 0) {
      toast.warning(`Published ${successCount} pages, ${errorCount} failed`);
    } else {
      toast.error('All publishes failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('pages').delete().eq('id', id);
      if (error) throw error;
      setPages(prev => prev.filter(p => p.id !== id));
      setSelectedPages(prev => prev.filter(p => p !== id));
      toast.success('Page removed');
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Failed to delete page');
    }
  };

  const getScore = (page: DBPage): number => {
    const scoreAfter = page.score_after as { overall?: number } | null;
    const scoreBefore = page.score_before as { overall?: number } | null;
    return scoreAfter?.overall || scoreBefore?.overall || 0;
  };

  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         page.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || page.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredPages.length / ITEMS_PER_PAGE);
  const paginatedPages = filteredPages.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const visibleIds = paginatedPages.map(p => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPages.includes(id));
  
  const selectedCompletedCount = pages.filter(
    p => selectedPages.includes(p.id) && p.status === 'completed'
  ).length;

  return (
    <>
      <Card className="glass-panel border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <List className="w-4 h-4 text-primary" />
              Page Queue
              <span className="text-muted-foreground font-normal text-sm">
                ({pages.length} pages)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedPages.length > 0 && (
                <>
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    onClick={handleOptimizeSelected}
                    disabled={isOptimizing || isPublishing}
                  >
                    {isOptimizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    {isOptimizing ? 'Optimizing...' : `Optimize ${selectedPages.length}`}
                  </Button>
                  {selectedCompletedCount > 0 && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1"
                        onClick={() => handlePublishSelected('draft')}
                        disabled={isOptimizing || isPublishing}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Save as Draft ({selectedCompletedCount})
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handlePublishSelected('publish')}
                        disabled={isOptimizing || isPublishing}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publish ({selectedCompletedCount})
                      </Button>
                    </div>
                  )}
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchPages}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-48 h-8 bg-muted/50"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-32 h-8 bg-muted/50">
                  <Filter className="w-3 h-3 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="optimizing">Optimizing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pages in queue</p>
              <p className="text-sm">Crawl a sitemap to add pages</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={selectAllVisible}
                        />
                      </TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-20 text-center">Score</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {paginatedPages.map((page) => (
                        <motion.tr
                          key={page.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedPages.includes(page.id)}
                              onCheckedChange={() => togglePageSelection(page.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[300px]">{page.slug || page.url}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {page.title}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <ScoreIndicator score={getScore(page)} size="sm" />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={page.status as any || 'pending'} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {(page.status === 'pending' || !page.status) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7" 
                                  title="Quick Optimize"
                                  onClick={() => handleOptimizeSingle(page.id)}
                                  disabled={isOptimizing}
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {page.status === 'optimizing' && (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              )}
                              {page.status === 'failed' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7" 
                                  title="Retry"
                                  onClick={() => handleOptimizeSingle(page.id)}
                                  disabled={isOptimizing}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {(page.status === 'completed' || page.status === 'published') && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7" 
                                    title="View Results"
                                    onClick={() => handleViewResult(page)}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </Button>
                                  {page.status === 'completed' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-green-500 hover:text-green-600" 
                                      title="Quick Publish"
                                      onClick={async () => {
                                        try {
                                          const { data: jobData } = await supabase
                                            .from('jobs')
                                            .select('result')
                                            .eq('page_id', page.id)
                                            .eq('status', 'completed')
                                            .order('completed_at', { ascending: false })
                                            .limit(1)
                                            .single();
                                          
                                          if (jobData?.result) {
                                            setSelectedPageResult({ page, result: jobData.result as unknown as OptimizationResult });
                                            handleValidateAndPublish();
                                          }
                                        } catch (err) {
                                          console.error('Error loading result for publish:', err);
                                          toast.error('Failed to load optimization result');
                                        }
                                      }}
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </>
                              )}
                              {page.status === 'published' && (
                                <CheckCheck className="w-4 h-4 text-green-500" />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Preview"
                                onClick={() => window.open(page.url, '_blank')}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(page.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {paginatedPages.length} of {filteredPages.length}
                  {selectedPages.length > 0 && ` • ${selectedPages.length} selected`}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'ghost'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Result Dialog - WITH SAFE DATA ACCESS */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Optimization Results
            </DialogTitle>
            <DialogDescription>
              {selectedPageResult?.page.title || 'Unknown page'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh] pr-4">
            {selectedPageResult?.result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Quality Score</p>
                    <p className="text-2xl font-bold text-primary">
                      {safeGetNumber(selectedPageResult.result.qualityScore, 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Word Count</p>
                    <p className="text-2xl font-bold">
                      {safeGetNumber(selectedPageResult.result.contentStrategy?.wordCount, 0) || 'N/A'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Optimized Title</p>
                  <p className="text-sm p-2 rounded bg-muted/50">
                    {safeGetString(selectedPageResult.result.optimizedTitle, 'No title generated')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Meta Description</p>
                  <p className="text-sm p-2 rounded bg-muted/50">
                    {safeGetString(selectedPageResult.result.metaDescription, 'No description generated')}
                  </p>
                </div>
                {safeGetArray(selectedPageResult.result.h2s).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">H2 Headings</p>
                    <ul className="space-y-1">
                      {safeGetArray(selectedPageResult.result.h2s).map((h2, i) => (
                        <li key={i} className="text-sm p-2 rounded bg-muted/50">• {h2}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {safeGetArray(selectedPageResult.result.tldrSummary).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">TL;DR Summary</p>
                    <ul className="space-y-1">
                      {safeGetArray(selectedPageResult.result.tldrSummary).map((point, i) => (
                        <li key={i} className="text-sm p-2 rounded bg-blue-500/10">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {safeGetArray(selectedPageResult.result.contentStrategy?.lsiKeywords).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">LSI Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {safeGetArray(selectedPageResult.result.contentStrategy?.lsiKeywords).map((kw, i) => (
                        <Badge key={i} variant="secondary">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No optimization data</p>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>Close</Button>
            {selectedPageResult?.result && selectedPageResult.page.status !== 'published' && (
              <Button onClick={handleValidateAndPublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Validate & Publish
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validationResult?.canPublish ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
              Content Validation
            </DialogTitle>
          </DialogHeader>
          {validationResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Overall Score</span>
                <span className="text-lg font-bold">{validationResult.overallScore}%</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="destructive">{validationResult.summary.errors} Errors</Badge>
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">{validationResult.summary.warnings} Warnings</Badge>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">{validationResult.summary.passed} Passed</Badge>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {safeGetArray(validationResult.checks).map((check, i) => (
                    <div key={i} className={cn("p-2 rounded-lg text-sm flex items-center justify-between", check.passed ? "bg-green-500/10" : check.severity === 'error' ? "bg-red-500/10" : "bg-yellow-500/10")}>
                      <div className="flex items-center gap-2">
                        {check.passed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : check.severity === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        <span>{check.name}</span>
                      </div>
                      <span className="text-muted-foreground">{check.actual} ({check.expected})</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowValidationDialog(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handlePublishSingle('draft')} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Save as Draft
            </Button>
            <Button onClick={() => handlePublishSingle('publish')} disabled={isPublishing || !validationResult?.canPublish} className="bg-green-600 hover:bg-green-700">
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Progress Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary animate-pulse" />
              Publishing to WordPress
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={(publishProgress.current / publishProgress.total) * 100} />
            <p className="text-sm text-center text-muted-foreground">{publishProgress.current} of {publishProgress.total} pages</p>
            <p className="text-sm text-center truncate">{publishProgress.status}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Progress Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {batchProgress.status === 'complete' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : batchProgress.status === 'error' ? <XCircle className="w-5 h-5 text-red-500" /> : <Zap className="w-5 h-5 text-primary animate-pulse" />}
              Batch Optimization
            </DialogTitle>
            <DialogDescription>Processing {batchProgress.total} pages</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={(batchProgress.completed / batchProgress.total) * 100} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{batchProgress.completed} / {batchProgress.total}</span>
            </div>
            {batchProgress.failed > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-red-500">Failed</span>
                <span className="font-medium text-red-500">{batchProgress.failed}</span>
              </div>
            )}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Currently processing</p>
              <p className="text-sm font-medium truncate">{batchProgress.current}</p>
            </div>
            {batchProgress.status === 'complete' && (
              <Button className="w-full" onClick={() => { 
                setShowBatchDialog(false); 
                const idleProgress: BatchProgress = { total: 0, completed: 0, failed: 0, current: '', status: 'idle' };
                setBatchProgress(idleProgress);
                batchProgressRef.current = idleProgress;
              }}>Done</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Optimization Progress */}
      {batchProgress.status === 'idle' && (
        <OptimizationProgress
          isActive={isOptimizing}
          currentStep={currentStepIndex}
          steps={optimizationSteps}
          pageTitle={optimizingPageTitle}
          serverProgress={activeJob?.progress ?? 0}
          serverStepName={activeJob?.currentStep}
          errorMessage={activeJob?.errorMessage}
          onDismiss={() => { 
            setIsOptimizing(false); 
            setOptimizingPageTitle(''); 
            stopWatching(); 
          }}
        />
      )}
    </>
  );
}
