import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Check, 
  AlertCircle, 
  Zap, 
  FileSearch, 
  Brain, 
  Shield, 
  Upload, 
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Wifi,
  WifiOff,
  Sparkles,
  Target,
  FileText,
  Link2,
  MessageSquare,
  BarChart3,
  RefreshCw,
  Pause,
  Play,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
export interface OptimizationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'completed' | 'error' | 'skipped';
  subSteps?: string[];
  estimatedDuration?: number; // seconds
}

interface OptimizationProgressProps {
  isActive: boolean;
  currentStep: number;
  steps?: OptimizationStep[];
  pageTitle?: string;
  serverProgress: number;
  serverStepName?: string;
  errorMessage?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  jobId?: string;
  aiProvider?: string;
  targetWordCount?: number;
  currentWordCount?: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_STEPS: OptimizationStep[] = [
  {
    id: 'validate',
    label: 'Validating Connection',
    description: 'Checking WordPress API access...',
    icon: <Shield className="w-4 h-4" />,
    status: 'pending',
    subSteps: ['Authenticating', 'Checking permissions', 'Validating endpoint'],
    estimatedDuration: 5,
  },
  {
    id: 'fetch',
    label: 'Fetching Content',
    description: 'Retrieving page content from WordPress...',
    icon: <FileSearch className="w-4 h-4" />,
    status: 'pending',
    subSteps: ['Loading page data', 'Fetching sitemap', 'Gathering internal links'],
    estimatedDuration: 10,
  },
  {
    id: 'analyze',
    label: 'AI Analysis',
    description: 'Analyzing content with AI models...',
    icon: <Brain className="w-4 h-4" />,
    status: 'pending',
    subSteps: ['Processing NeuronWriter', 'Analyzing competitors', 'Identifying keywords'],
    estimatedDuration: 30,
  },
  {
    id: 'optimize',
    label: 'Generating Content',
    description: 'Creating SEO-optimized content...',
    icon: <Zap className="w-4 h-4" />,
    status: 'pending',
    subSteps: ['Writing Hormozi-style content', 'Adding internal links', 'Generating FAQs', 'Creating schema'],
    estimatedDuration: 120,
  },
  {
    id: 'save',
    label: 'Saving Results',
    description: 'Storing optimization in database...',
    icon: <Upload className="w-4 h-4" />,
    status: 'pending',
    subSteps: ['Validating output', 'Saving to database', 'Updating page status'],
    estimatedDuration: 5,
  },
];

const STEP_DESCRIPTIONS: Record<string, { label: string; description: string; stepIndex: number }> = {
  'queued': { label: 'Queued', description: 'Waiting in queue...', stepIndex: 0 },
  'validating': { label: 'Validating', description: 'Validating WordPress connection...', stepIndex: 0 },
  'fetching_content': { label: 'Fetching', description: 'Fetching page content...', stepIndex: 1 },
  'fetching_sitemap_pages': { label: 'Sitemap', description: 'Loading sitemap pages for internal linking...', stepIndex: 1 },
  'fetching_wordpress': { label: 'WordPress', description: 'Retrieving WordPress data...', stepIndex: 1 },
  'fetching_neuronwriter': { label: 'NeuronWriter', description: 'Getting NeuronWriter recommendations...', stepIndex: 2 },
  'waiting_neuronwriter': { label: 'NeuronWriter', description: 'Waiting for NeuronWriter analysis...', stepIndex: 2 },
  'analyzing_content': { label: 'Analyzing', description: 'Analyzing content structure...', stepIndex: 2 },
  'generating_content': { label: 'Generating', description: 'AI is generating optimized content...', stepIndex: 3 },
  'processing_response': { label: 'Processing', description: 'Processing AI response...', stepIndex: 3 },
  'validating_content': { label: 'Validating', description: 'Validating optimized content...', stepIndex: 4 },
  'optimization_complete': { label: 'Saving', description: 'Saving results...', stepIndex: 4 },
  'saving_results': { label: 'Saving', description: 'Saving to database...', stepIndex: 4 },
  'completed': { label: 'Complete', description: 'Optimization complete!', stepIndex: 5 },
  'failed': { label: 'Failed', description: 'Optimization failed', stepIndex: -1 },
};

const MOTIVATIONAL_MESSAGES = [
  "Building something amazing...",
  "Crafting compelling content...",
  "Optimizing for search engines...",
  "Making your content shine...",
  "Applying Hormozi magic...",
  "Generating high-impact copy...",
  "Perfecting every detail...",
  "Almost there...",
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function formatETA(seconds: number): string {
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `~${minutes}m ${remainingSeconds}s`;
}

function getProgressGradient(progress: number, hasFailed: boolean): string {
  if (hasFailed) return 'from-red-500 to-red-600';
  if (progress < 25) return 'from-blue-500 via-blue-400 to-cyan-400';
  if (progress < 50) return 'from-cyan-500 via-teal-400 to-emerald-400';
  if (progress < 75) return 'from-emerald-500 via-green-400 to-lime-400';
  if (progress < 100) return 'from-lime-500 via-yellow-400 to-amber-400';
  return 'from-amber-500 via-orange-400 to-primary';
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function PulsingDot({ color = 'primary' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn(
        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
        color === 'primary' ? 'bg-primary' : 
        color === 'destructive' ? 'bg-destructive' :
        color === 'success' ? 'bg-emerald-500' : 'bg-primary'
      )} />
      <span className={cn(
        "relative inline-flex rounded-full h-2 w-2",
        color === 'primary' ? 'bg-primary' : 
        color === 'destructive' ? 'bg-destructive' :
        color === 'success' ? 'bg-emerald-500' : 'bg-primary'
      )} />
    </span>
  );
}

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      isConnected 
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {isConnected ? (
        <>
          <Wifi className="w-3 h-3" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Reconnecting...</span>
        </>
      )}
    </div>
  );
}

function StepIndicator({ 
  step, 
  index, 
  currentStep, 
  isActive,
  hasFailed 
}: { 
  step: OptimizationStep; 
  index: number; 
  currentStep: number;
  isActive: boolean;
  hasFailed: boolean;
}) {
  const isCompleted = index < currentStep;
  const isCurrent = index === currentStep;
  const isPending = index > currentStep;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="flex flex-col items-center"
    >
      <div className={cn(
        "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
        isCompleted && "bg-emerald-500/20 text-emerald-500 ring-2 ring-emerald-500/30",
        isCurrent && !hasFailed && "bg-primary/20 text-primary ring-2 ring-primary/50 shadow-lg shadow-primary/20",
        isCurrent && hasFailed && "bg-destructive/20 text-destructive ring-2 ring-destructive/50",
        isPending && "bg-muted/50 text-muted-foreground"
      )}>
        {isCompleted ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Check className="w-5 h-5" />
          </motion.div>
        ) : isCurrent && hasFailed ? (
          <XCircle className="w-5 h-5" />
        ) : isCurrent ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-5 h-5" />
          </motion.div>
        ) : (
          step.icon
        )}
        
        {/* Glow effect for active step */}
        {isCurrent && !hasFailed && (
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md -z-10" />
        )}
      </div>
      
      <span className={cn(
        "mt-2 text-xs font-medium text-center max-w-[80px] truncate",
        isCompleted && "text-emerald-600 dark:text-emerald-400",
        isCurrent && !hasFailed && "text-primary",
        isCurrent && hasFailed && "text-destructive",
        isPending && "text-muted-foreground"
      )}>
        {step.label.split(' ')[0]}
      </span>
    </motion.div>
  );
}

function ProgressRing({ progress, size = 120, strokeWidth = 8 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.8)" />
            <stop offset="100%" stopColor="hsl(142 76% 36%)" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{Math.round(progress)}%</span>
        <span className="text-xs text-muted-foreground">Complete</span>
      </div>
    </div>
  );
}

function DetailedStepInfo({ 
  serverStepName, 
  progress,
  elapsedTime 
}: { 
  serverStepName?: string;
  progress: number;
  elapsedTime: number;
}) {
  const stepInfo = serverStepName ? STEP_DESCRIPTIONS[serverStepName] : null;
  
  return (
    <div className="space-y-3">
      {/* Current operation */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {stepInfo?.label || 'Processing'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {stepInfo?.description || 'Working on your content...'}
          </p>
        </div>
        <PulsingDot color="primary" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/20">
          <Clock className="w-3.5 h-3.5 text-muted-foreground mb-1" />
          <span className="text-xs font-medium">{formatTime(elapsedTime)}</span>
          <span className="text-[10px] text-muted-foreground">Elapsed</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/20">
          <Target className="w-3.5 h-3.5 text-muted-foreground mb-1" />
          <span className="text-xs font-medium">{Math.round(progress)}%</span>
          <span className="text-[10px] text-muted-foreground">Progress</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-muted/20">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground mb-1" />
          <span className="text-xs font-medium">
            {progress > 0 ? formatETA(((100 - progress) / progress) * (elapsedTime / 1000)) : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground">ETA</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function OptimizationProgress({ 
  isActive, 
  currentStep, 
  steps = DEFAULT_STEPS,
  pageTitle,
  serverProgress,
  serverStepName,
  errorMessage,
  onDismiss,
  onRetry,
  onCancel,
  jobId,
  aiProvider,
  targetWordCount,
  currentWordCount,
}: OptimizationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [motivationalIndex, setMotivationalIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  
  const startTimeRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(0);
  const lastProgressTimeRef = useRef<number>(Date.now());

  // Detect stalled progress
  const isStalled = useMemo(() => {
    return serverProgress === lastProgressRef.current && 
      (Date.now() - lastProgressTimeRef.current) > 60000 &&
      serverProgress > 0 && serverProgress < 100;
  }, [serverProgress]);

  // Track progress updates
  useEffect(() => {
    if (serverProgress !== lastProgressRef.current) {
      lastProgressRef.current = serverProgress;
      lastProgressTimeRef.current = Date.now();
      setIsConnected(true);
    }
  }, [serverProgress]);

  // Timer for elapsed time
  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      lastProgressRef.current = 0;
      lastProgressTimeRef.current = Date.now();
      
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Date.now() - startTimeRef.current);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
    }
  }, [isActive]);

  // Rotate motivational messages
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setMotivationalIndex(prev => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Detect connection issues
  useEffect(() => {
    if (isStalled) {
      const timeout = setTimeout(() => setIsConnected(false), 30000);
      return () => clearTimeout(timeout);
    }
  }, [isStalled]);

  if (!isActive) return null;

  const progress = Math.min(Math.max(serverProgress, 0), 100);
  const hasFailed = !!errorMessage;
  const isComplete = progress >= 100 && !hasFailed;

  // Minimized view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className={cn(
            "relative h-14 w-14 rounded-full shadow-2xl",
            hasFailed ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
          )}
        >
          <div className="relative">
            {hasFailed ? (
              <XCircle className="w-6 h-6" />
            ) : isComplete ? (
              <Check className="w-6 h-6" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-6 h-6" />
              </motion.div>
            )}
          </div>
          
          {/* Progress ring around button */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="26"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-white/20"
            />
            <circle
              cx="28"
              cy="28"
              r="26"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-white"
              strokeDasharray={`${progress * 1.63} 163`}
              strokeLinecap="round"
            />
          </svg>
        </Button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-[420px]"
      >
        <div className={cn(
          "bg-card/95 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden",
          hasFailed ? "border-destructive/30" : "border-primary/20"
        )}>
          {/* Header */}
          <div className={cn(
            "relative p-4 border-b",
            hasFailed 
              ? "bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-destructive/20"
              : isComplete
              ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20"
              : "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-border/50"
          )}>
            {/* Animated background pattern */}
            {!hasFailed && !isComplete && (
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
                />
              </div>
            )}

            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "relative p-2.5 rounded-xl",
                  hasFailed ? "bg-destructive/20" : isComplete ? "bg-emerald-500/20" : "bg-primary/20"
                )}>
                  {hasFailed ? (
                    <XCircle className="w-6 h-6 text-destructive" />
                  ) : isComplete ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <Check className="w-6 h-6 text-emerald-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="text-primary"
                    >
                      <Loader2 className="w-6 h-6" />
                    </motion.div>
                  )}
                  
                  {/* Glow effect */}
                  {!hasFailed && !isComplete && (
                    <div className="absolute inset-0 bg-primary/30 rounded-xl blur-md" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {hasFailed ? 'Optimization Failed' : isComplete ? 'Optimization Complete!' : 'Optimizing Content'}
                  </h3>
                  {pageTitle && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {pageTitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ConnectionStatus isConnected={isConnected} />
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsMinimized(true)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                
                {onCancel && !isComplete && !hasFailed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={onCancel}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* AI Provider badge */}
            {aiProvider && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {aiProvider}
                </span>
                {jobId && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Job: {jobId.slice(0, 8)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Main Progress Section */}
          <div className="p-4">
            {/* Progress Ring + Stats */}
            <div className="flex items-center gap-6 mb-4">
              <ProgressRing progress={progress} size={100} strokeWidth={6} />
              
              <div className="flex-1 space-y-3">
                {/* Motivational message */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={motivationalIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-sm font-medium text-foreground"
                  >
                    {hasFailed ? errorMessage : isComplete ? 'All done!' : MOTIVATIONAL_MESSAGES[motivationalIndex]}
                  </motion.p>
                </AnimatePresence>

                {/* Mini progress bar */}
                <div className="space-y-1">
                  <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
                        getProgressGradient(progress, hasFailed)
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                    
                    {/* Shimmer effect */}
                    {!hasFailed && !isComplete && (
                      <motion.div
                        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: [-80, 400] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(elapsedTime)}</span>
                    <span>
                      {isComplete ? 'Complete!' : hasFailed ? 'Failed' : 'Processing...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between items-start mb-4 px-2">
              {steps.map((step, index) => (
                <StepIndicator
                  key={step.id}
                  step={step}
                  index={index}
                  currentStep={currentStep}
                  isActive={isActive}
                  hasFailed={hasFailed}
                />
              ))}
            </div>

            {/* Expandable Details */}
            <motion.div
              initial={false}
              animate={{ height: isExpanded ? 'auto' : 0 }}
              className="overflow-hidden"
            >
              {isExpanded && (
                <DetailedStepInfo 
                  serverStepName={serverStepName}
                  progress={progress}
                  elapsedTime={elapsedTime}
                />
              )}
            </motion.div>

            {/* Expand/Collapse Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </div>

          {/* Stalled Warning */}
          {isStalled && !hasFailed && !isComplete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="px-4 pb-4"
            >
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Progress appears stalled
                  </p>
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                    The server may still be processing large content. Please wait...
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    lastProgressTimeRef.current = Date.now();
                    setIsConnected(true);
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          {(hasFailed || isComplete) && (
            <div className="px-4 pb-4">
              <div className="flex gap-2">
                {hasFailed && onRetry && (
                  <Button 
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={onRetry}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                )}
                {onDismiss && (
                  <Button 
                    variant={hasFailed ? "outline" : "default"}
                    size="sm"
                    className={cn(
                      "flex-1",
                      isComplete && "bg-emerald-500 hover:bg-emerald-600"
                    )}
                    onClick={onDismiss}
                  >
                    {isComplete ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        View Results
                      </>
                    ) : (
                      'Dismiss'
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export { DEFAULT_STEPS };
