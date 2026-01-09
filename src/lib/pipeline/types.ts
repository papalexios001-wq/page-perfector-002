/**
 * ENTERPRISE-GRADE PIPELINE TYPES
 * Multi-stage content generation with real-time progress tracking
 */

// ============ JOB STATE MACHINE ============
export type JobState = 
  | 'pending' 
  | 'briefing'
  | 'outlining' 
  | 'drafting'
  | 'enriching' 
  | 'quality_check'
  | 'rendering'
  | 'complete'
  | 'failed';

export type JobMode = 'generate' | 'optimize';

// ============ JOB & PROGRESS ============
export interface ContentJob {
  jobId: string;
  siteId: string;
  postId?: string;
  url?: string;
  mode: JobMode;
  state: JobState;
  progress: number; // 0-100
  currentStep: string;
  steps: JobStep[];
  result?: ContentOutput;
  metadata?: Record<string, any>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface JobStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startTime?: Date;
  duration: number; // ms
  message: string;
  progress: number;
  data?: Record<string, any>;
}

export interface ContentOutput {
  articleComponents: ArticleComponent[];
  htmlString: string;
  plainText: string;
  seoMetrics: SEOScore;
  wordCount: number;
  readingTime: number; // minutes
}

// ============ ARTICLE COMPONENTS ============
export type ArticleComponent = 
  | IntroductionBlock
  | HeadingBlock
  | ParagraphBlock
  | TldrBlock
  | KeyTakeawaysBlock
  | DoAvoidBlock
  | ChecklistBlock
  | CalloutBlock
  | QuoteBlock
  | VideoBlock
  | FaqBlock
  | ComparisonTableBlock
  | ConclusionBlock
  | CtaBlock;

export interface BaseBlock {
  id: string;
  type: string;
  order: number;
  alignment?: 'left' | 'center' | 'right';
}

export interface IntroductionBlock extends BaseBlock {
  type: 'introduction';
  content: string;
  hooks: string[]; // opening hooks
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
  slug: string;
  icon?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;
  emphasis?: boolean;
}

export interface TldrBlock extends BaseBlock {
  type: 'tldr';
  title: string;
  bullets: string[];
  icon?: 'lightning' | 'star' | 'target';
  style?: 'default' | 'compact' | 'highlight';
}

export interface KeyTakeawaysBlock extends BaseBlock {
  type: 'key_takeaways';
  title: string;
  items: TakeawayItem[];
  columns?: 2 | 3 | 4;
  style?: 'grid' | 'list';
}

export interface TakeawayItem {
  title: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface DoAvoidBlock extends BaseBlock {
  type: 'do_avoid';
  title?: string;
  dos: DoAvoidItem[];
  donts: DoAvoidItem[];
  icon?: string;
}

export interface DoAvoidItem {
  text: string;
  explanation?: string;
}

export interface ChecklistBlock extends BaseBlock {
  type: 'checklist';
  title: string;
  items: ChecklistItem[];
  isInteractive: boolean;
  compact?: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  subItems?: ChecklistItem[];
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  style: 'info' | 'warning' | 'success' | 'error' | 'tip';
  title?: string;
  content: string;
  icon?: string;
  cta?: { text: string; href: string };
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  text: string;
  author?: string;
  source?: string;
  style?: 'default' | 'highlighted' | 'large';
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  transcript?: string;
  timestamps?: VideoTimestamp[];
}

export interface VideoTimestamp {
  time: number; // seconds
  label: string;
  description?: string;
}

export interface FaqBlock extends BaseBlock {
  type: 'faq';
  title: string;
  items: FaqItem[];
  schema?: boolean; // generate JSON-LD
}

export interface FaqItem {
  question: string;
  answer: string;
  tags?: string[];
}

export interface ComparisonTableBlock extends BaseBlock {
  type: 'comparison_table';
  title: string;
  headers: string[];
  rows: ComparisonRow[];
  bestChoice?: number; // index of best option
}

export interface ComparisonRow {
  feature: string;
  cells: string[];
  highlight?: boolean;
}

export interface ConclusionBlock extends BaseBlock {
  type: 'conclusion';
  summary: string;
  keyPoints: string[];
}

export interface CtaBlock extends BaseBlock {
  type: 'cta';
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  style?: 'primary' | 'secondary' | 'outlined';
}

// ============ SEO METRICS ============
export interface SEOScore {
  overall: number; // 0-100
  readability: number;
  completeness: number;
  entityCoverage: number;
  internalLinking: number;
  schemaOptimization: number;
  snippetReadiness: number;
  keywordOptimization: number;
  failingAspects: string[];
  recommendations: string[];
}

// ============ SERP BRIEF ============
export interface SerpBrief {
  query: string;
  searchIntent: 'informational' | 'commercial' | 'navigational' | 'transactional';
  volumePerMonth: number;
  difficulty: number; // 0-100
  topEntities: string[];
  paaQuestions: string[];
  competitorTitles: string[];
  competitorGaps: string[];
  suggestedHeadings: string[];
  missingAngles: string[];
}

// ============ OUTLINE ============
export interface ContentOutline {
  title: string;
  intro: OutlineSection;
  sections: OutlineSection[];
  conclusion: OutlineSection;
}

export interface OutlineSection {
  heading: string;
  level: number;
  objective: string; // what this section must achieve
  keyPoints: string[];
  examples?: string[];
  subsections?: OutlineSection[];
}
