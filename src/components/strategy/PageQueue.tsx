import { useState, useEffect, useCallback } from 'react';
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
  optimizedTitle: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  optimizedContent?: string;
  tldrSummary?: string[];
  expertQuote?: { quote: string; author: string; role: string };
  youtubeEmbed?: { searchQuery: string; suggestedTitle: string; context: string };
  patentReference?: { type: string; identifier: string; title: string; summary: string; link: string };
  faqs?: Array<{ question: string; answer: string }>;
  keyTakeaways?: string[];
  contentStrategy: {
    wordCount: number;
    readabilityScore: number;
    keywordDensity: number;
    lsiKeywords: string[];
  };
  internalLinks: Array<{ anchor: string; target: string; position: number }>;
  schema: Record<string, unknown>;
  aiSuggestions: {
    contentGaps: string;
    quickWins: string;
    improvements: string[];
  };
  qualityScore: number;
  seoScore?: number;
  readabilityScore?: number;
  engagementScore?: number;
  estimatedRankPosition: number;
  confidenceLevel: number;
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
    onComplete: async (job) => {
      console.log('[PageQueue] Job completed:', job);
      
      // For single optimization, show result dialog
      if (batchProgress.status === 'idle') {
        setIsOptimizing(false);
        setOptimizingPageTitle('');
        await fetchPages();
        
        if (job.result) {
          const pageToShow = pages.find(p => p.id === job.pageId);
          if (pageToShow) {
            const optimization = job.result as unknown as OptimizationResult;
            setSelectedPageResult({ page: pageToShow, result: optimization });
            setShowResultDialog(true);
            toast.success('Page optimized successfully!', {
              description: `Quality score: ${optimization.qualityScore}/100, Words: ${optimization.contentStrategy?.wordCount || 'N/A'}`,
            });
          }
        }
      }
    },
    onError: async (job) => {
      console.log('[PageQueue] Job failed:', job);
      
      if (batchProgress.status === 'idle') {
        setIsOptimizing(false);
        setOptimizingPageTitle('');
        await fetchPages();
        toast.error('Optimization failed', {
          description: job.errorMessage || 'Check the console for details.',
        });
      }
    }
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
      setPages(data || []);
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
  }, [wordpress, ai, neuronWriter, advanced, siteContext]);

  // Wait for a job to complete by polling the database
  const waitForJobCompletion = async (pageId: string, jobId: string, timeoutMs: number = 600000): Promise<{ success: boolean; error?: string }> => {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < timeoutMs) {
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
  // FIXED: BATCH OPTIMIZATION - Process pages sequentially with proper tracking
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
    setBatchProgress({
      total: pagesToOptimize.length,
      completed: 0,
      failed: 0,
      current: pagesToOptimize[0]?.title || pagesToOptimize[0]?.slug || 'Unknown',
      status: 'running',
    });
    setShowBatchDialog(true);
    setIsOptimizing(true);

    let successCount = 0;
    let errorCount = 0;

    // Process pages SEQUENTIALLY with proper tracking
    for (let i = 0; i < pagesToOptimize.length; i++) {
      const page = pagesToOptimize[i];
      
      // Update batch progress
      setBatchProgress(prev => ({
        ...prev,
        current: page.title || page.slug || 'Unknown',
        completed: i,
      }));

      // Update page status in UI
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'optimizing' } : p));

      console.log(`[Batch] Starting optimization ${i + 1}/${pagesToOptimize.length}: ${page.slug}`);

      // Start the job
      const { success: jobStarted, jobId, error: startError } = await startOptimizationJob(page.id);

      if (!jobStarted || !jobId) {
        console.error(`[Batch] Failed to start job for ${page.slug}:`, startError);
        errorCount++;
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'failed' } : p));
        setBatchProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
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
        setBatchProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      // Small delay between jobs to avoid rate limiting
      if (i < pagesToOptimize.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Complete batch
    setBatchProgress(prev => ({
      ...prev,
      completed: prev.total,
      status: errorCount === pagesToOptimize.length ? 'error' : 'complete',
    }));

    // Refresh pages and cleanup
    await fetchPages();
    setIsOptimizing(false);
    setSelectedPages([]);

    // Show summary toast
    setTimeout(() => {
      setShowBatchDialog(false);
      setBatchProgress({ total: 0, completed: 0, failed: 0, current: '', status: 'idle' });
      
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
  };

  const handleViewResult = async (page: DBPage) => {
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
  };

  const validateOptimization = async (optimization: OptimizationResult): Promise<ValidationResult | null> => {
    const { data, error } = await invokeEdgeFunction<ValidationResult>('validate-content', {
      optimization,
      minQualityScore: 75,
    });

    if (error) {
      console.error('[Validate] Error:', error);
      return null;
    }

    return data;
  };

  const publishToWordPress = async (
    pageId: string, 
    optimization: OptimizationResult,
    publishStatus: 'draft' | 'publish' = 'draft'
  ): Promise<{ success: boolean; error?: string; postUrl?: string }> => {
    if (!wordpress.siteUrl || !wordpress.username || !wordpress.applicationPassword) {
      return { success: false, error: 'WordPress not configured' };
    }

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
      toast.error('No
