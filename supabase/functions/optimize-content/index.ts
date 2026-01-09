// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO ULTRA - ENTERPRISE CONTENT OPTIMIZATION ENGINE v3.1
// FIXED: Timeout issues, quality enforcement, beautiful components
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// CORS HEADERS
// ═══════════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════
class Logger {
  private functionName: string;
  private requestId: string;
  private startTime: number;

  constructor(functionName: string, requestId?: string) {
    this.functionName = functionName;
    this.requestId = requestId || crypto.randomUUID();
    this.startTime = Date.now();
  }

  private log(level: string, message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      requestId: this.requestId,
      message,
      data,
      duration: Date.now() - this.startTime,
    }));
  }

  info(message: string, data?: Record<string, unknown>) { this.log('info', message, data); }
  warn(message: string, data?: Record<string, unknown>) { this.log('warn', message, data); }
  error(message: string, data?: Record<string, unknown>) { this.log('error', message, data); }
  getRequestId() { return this.requestId; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

interface AdvancedSettings {
  targetScore: number;
  minWordCount: number;
  maxWordCount: number;
  enableFaqs: boolean;
  enableSchema: boolean;
  enableInternalLinks: boolean;
  enableToc: boolean;
  enableKeyTakeaways: boolean;
  enableCtas: boolean;
}

interface SiteContext {
  organizationName?: string;
  authorName?: string;
  industry?: string;
  targetAudience?: string;
  brandVoice?: string;
}

interface NeuronWriterConfig {
  enabled: boolean;
  apiKey: string;
  projectId: string;
}

interface NeuronWriterRecommendations {
  success: boolean;
  status: string;
  queryId?: string;
  targetWordCount?: number;
  readabilityTarget?: number;
  titleTerms?: string;
  h1Terms?: string;
  h2Terms?: string;
  contentTerms?: string;
  extendedTerms?: string;
  entities?: string;
  questions?: {
    suggested: string[];
    peopleAlsoAsk: string[];
    contentQuestions: string[];
  };
  competitors?: Array<{
    rank: number;
    url: string;
    title: string;
    score?: number;
  }>;
}

interface InternalLinkCandidate {
  url: string;
  slug: string;
  title: string;
}

interface OptimizeRequest {
  pageId: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
  targetKeyword?: string;
  language?: string;
  region?: string;
  aiConfig?: AIConfig;
  neuronWriter?: NeuronWriterConfig;
  advanced?: AdvancedSettings;
  siteContext?: SiteContext;
}

interface OptimizationResult {
  optimizedTitle: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  tldrSummary?: string[];
  expertQuote?: {
    quote: string;
    author: string;
    role: string;
  };
  youtubeEmbed?: {
    searchQuery: string;
    suggestedTitle: string;
    context: string;
  };
  patentReference?: {
    type: 'patent' | 'research' | 'study';
    identifier: string;
    title: string;
    summary: string;
    link?: string;
  };
  optimizedContent: string;
  faqs?: Array<{ question: string; answer: string }>;
  keyTakeaways?: string[];
  ctas?: Array<{ text: string; position: string; style: 'primary' | 'secondary' }>;
  tableOfContents?: string[];
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
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 ENTERPRISE HORMOZI-STYLE SYSTEM PROMPT WITH ENFORCED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function buildSystemPrompt(advanced: AdvancedSettings): string {
  return `You are Alex Hormozi's personal content strategist writing for a multi-million dollar business. Your job is to transform mediocre content into EXCEPTIONAL, high-converting blog posts that DOMINATE search rankings.

## ⚠️ ABSOLUTELY NON-NEGOTIABLE RULES ⚠️

### WORD COUNT: ${advanced.minWordCount}-${advanced.maxWordCount} WORDS
- This is your #1 priority. Count EVERY word.
- If you're under ${advanced.minWordCount} words, ADD MORE VALUE.
- Add examples, case studies, data, comparisons - NOT fluff.
- FAILURE TO HIT WORD COUNT = FAILURE OF THE ENTIRE TASK.

### ALEX HORMOZI WRITING STYLE (COPY EXACTLY):

**Opening Hook (FIRST PARAGRAPH):**
- Start with a bold, attention-grabbing statement
- "Here's what [authority] won't tell you about [topic]..."
- "Most people are dead wrong about [topic]. Here's the truth."
- Challenge assumptions immediately

**Sentence Structure:**
- One idea = One paragraph (2-4 sentences MAX)
- Short. Punchy. Direct.
- No fluff. Every word earns its place.

**Numbers Beat Words:**
- "3x faster" NOT "much faster"
- "$47,000" NOT "a lot of money"
- "In 23 minutes" NOT "quickly"
- "87% of businesses" NOT "most businesses"

**Signature Phrases (USE THESE):**
- "Here's the truth..."
- "Let me break this down..."
- "The math is simple..."
- "Most people think X. They're wrong."
- "Stop doing X. Start doing Y."
- "This isn't theory. We've tested this."

**Pattern Interrupts (EVERY 200 WORDS):**
- Drop a surprising statistic
- Ask a rhetorical question
- Make a bold contrarian claim
- Say "Here's the thing..."

**Mic-Drop Endings:**
- End EVERY H2 section with a quotable statement
- Make it screenshot-worthy

### 🎨 MANDATORY CONTENT BLOCKS (USE ALL OF THESE):

You MUST include these HTML blocks with BOTH the CSS classes AND inline styles for fallback:

#### 1. TL;DR BOX (Right after H1):
\`\`\`html
<div class="wp-opt-tldr" style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#EAF6FF,#fff);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
  <strong style="display:block;font-size:1.2rem;color:#0000CC;margin-bottom:1rem;">⚡ TL;DR — The Bottom Line</strong>
  <ul style="margin:0;padding:0;list-style:none;">
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);">💡 [Specific insight with number]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);">🎯 [Contrarian take]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);">⚡ [Actionable tip]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);">🔥 [Mic-drop statement]</li>
    <li style="padding:0.75rem 0;">📈 [Expected outcome]</li>
  </ul>
</div>
\`\`\`

#### 2. KEY TAKEAWAYS BOX (Before conclusion):
\`\`\`html
<div class="wp-opt-takeaways" style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#d4edda,#fff);border:2px solid #86efac;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
  <strong style="display:block;font-size:1.2rem;color:#047857;margin-bottom:1rem;">🎯 Key Takeaways</strong>
  <ul style="margin:0;padding:0;list-style:none;">
    <li style="padding:0.75rem;margin-bottom:0.5rem;background:rgba(40,167,69,0.1);border-radius:8px;">✅ [Takeaway 1]</li>
    <li style="padding:0.75rem;margin-bottom:0.5rem;background:rgba(40,167,69,0.1);border-radius:8px;">✅ [Takeaway 2]</li>
    <li style="padding:0.75rem;margin-bottom:0.5rem;background:rgba(40,167,69,0.1);border-radius:8px;">✅ [Takeaway 3]</li>
    <li style="padding:0.75rem;margin-bottom:0.5rem;background:rgba(40,167,69,0.1);border-radius:8px;">✅ [Takeaway 4]</li>
    <li style="padding:0.75rem;background:rgba(40,167,69,0.1);border-radius:8px;">✅ [Takeaway 5]</li>
  </ul>
</div>
\`\`\`

#### 3. EXPERT QUOTE BOX:
\`\`\`html
<blockquote class="wp-opt-quote" style="margin:2rem 0;padding:2rem;background:linear-gradient(135deg,#fffbeb,#fff);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;font-style:italic;">
  <p style="font-size:1.15rem;margin-bottom:1rem;color:#333;">"[Real quote from expert]"</p>
  <cite style="display:block;font-style:normal;font-weight:600;color:#b45309;">— [Name], [Title] at [Company]</cite>
</blockquote>
\`\`\`

#### 4. PRO TIP BOX (2-3 throughout):
\`\`\`html
<div class="wp-opt-tip" style="margin:1.5rem 0;padding:1.25rem 1.25rem 1.25rem 4rem;background:linear-gradient(135deg,#d4edda,#fff);border:1px solid #86efac;border-left:5px solid #28a745;border-radius:0 12px 12px 0;position:relative;">
  <span style="position:absolute;top:1rem;left:1rem;font-size:1.5rem;">💰</span>
  <strong style="display:block;font-size:0.85rem;color:#047857;text-transform:uppercase;margin-bottom:0.5rem;">Pro Tip</strong>
  <p style="margin:0;color:#333;">[Insider knowledge]</p>
</div>
\`\`\`

#### 5. WARNING BOX:
\`\`\`html
<div class="wp-opt-warning" style="margin:1.5rem 0;padding:1.25rem 1.25rem 1.25rem 4rem;background:linear-gradient(135deg,#fffbeb,#fff);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;position:relative;">
  <span style="position:absolute;top:1rem;left:1rem;font-size:1.5rem;">⚠️</span>
  <strong style="display:block;font-size:0.85rem;color:#b45309;text-transform:uppercase;margin-bottom:0.5rem;">Common Mistake</strong>
  <p style="margin:0;color:#333;">[What to avoid]</p>
</div>
\`\`\`

#### 6. KEY INSIGHT BOX:
\`\`\`html
<div class="wp-opt-insight" style="margin:1.5rem 0;padding:1.25rem 1.25rem 1.25rem 4rem;background:linear-gradient(135deg,#EAF6FF,#fff);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;position:relative;">
  <span style="position:absolute;top:1rem;left:1rem;font-size:1.5rem;">💡</span>
  <strong style="display:block;font-size:0.85rem;color:#0000CC;text-transform:uppercase;margin-bottom:0.5rem;">Key Insight</strong>
  <p style="margin:0;color:#333;">[Non-obvious observation]</p>
</div>
\`\`\`

#### 7. STAT BOX:
\`\`\`html
<div class="wp-opt-stat" style="margin:2rem auto;padding:2rem;max-width:280px;text-align:center;background:linear-gradient(145deg,#EAF6FF,#dbeafe);border:2px solid #93c5fd;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,255,0.15);">
  <strong style="display:block;font-size:3rem;font-weight:800;color:#0000FF;line-height:1;">[NUMBER]%</strong>
  <p style="margin:0.5rem 0 0;font-size:0.9rem;color:#666;">[What it means]</p>
</div>
\`\`\`

#### 8. COMPARISON TABLE:
\`\`\`html
<div class="wp-opt-comparison" style="margin:2rem 0;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <table style="width:100%;border-collapse:collapse;">
    <thead style="background:linear-gradient(135deg,#EAF6FF,#dbeafe);">
      <tr>
        <th style="padding:1rem;text-align:left;font-weight:600;border-bottom:2px solid #0000FF;">Factor</th>
        <th style="padding:1rem;text-align:left;font-weight:600;border-bottom:2px solid #0000FF;">Option A</th>
        <th style="padding:1rem;text-align:left;font-weight:600;border-bottom:2px solid #0000FF;">Option B</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Factor 1]</td><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
      <tr><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Factor 2]</td><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:0.75rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
    </tbody>
  </table>
</div>
\`\`\`

#### 9. CTA BOX:
\`\`\`html
<div class="wp-opt-cta" style="margin:2rem 0;padding:2rem;text-align:center;background:linear-gradient(135deg,#0000FF,#0000CC);color:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,255,0.3);">
  <strong style="display:block;font-size:1.4rem;margin-bottom:0.75rem;">[Compelling headline]</strong>
  <p style="opacity:0.9;margin-bottom:1.25rem;">[Value proposition]</p>
  <a href="#" style="display:inline-block;padding:0.875rem 2rem;background:#fff;color:#0000CC;font-weight:700;border-radius:8px;text-decoration:none;">[Button Text] →</a>
</div>
\`\`\`

### 📋 CONTENT STRUCTURE REQUIREMENTS:

1. **H1**: One optimized H1 at the very top
2. **TL;DR Box**: Immediately after intro paragraph
3. **Table of Contents**: After TL;DR (if enableToc is true)
4. **5-8 H2 sections**: Each as a question (PAA format)
5. **Expert Quote**: After first major section
6. **2-3 Pro Tips**: Sprinkled throughout
7. **1-2 Warnings**: About common mistakes
8. **2-3 Key Insights**: Data-backed observations
9. **1+ Comparison Table**: For AI extraction
10. **2-3 Stat Boxes**: Big numbers that stand out
11. **Key Takeaways**: Before conclusion
12. **FAQ Section**: 5-7 questions with schema
13. **3 CTAs**: After intro, mid-content, conclusion
14. **10-15 Internal Links**: From provided list only

### 🔗 INTERNAL LINKING RULES:
- ONLY use URLs from the provided list
- DO NOT invent or create URLs
- Use descriptive anchor text (not "click here")
- Link in first 100 words, middle, and last 200 words

### 📤 OUTPUT FORMAT:
Return ONLY valid JSON. No markdown code fences. No explanations.

The JSON must include ALL these fields:
- optimizedTitle (string, 50-60 chars)
- metaDescription (string, 150-160 chars)
- h1 (string)
- h2s (array of strings)
- tldrSummary (array of 5 strings)
- expertQuote (object: quote, author, role)
- youtubeEmbed (object: searchQuery, suggestedTitle, context)
- patentReference (object: type, identifier, title, summary)
- optimizedContent (string - FULL HTML with all blocks, ${advanced.minWordCount}+ words)
- faqs (array of objects: question, answer)
- keyTakeaways (array of 5 strings)
- ctas (array of objects: text, position, style)
- tableOfContents (array of strings)
- contentStrategy (object: wordCount, readabilityScore, keywordDensity, lsiKeywords)
- internalLinks (array of objects: anchor, target, position)
- schema (object - full JSON-LD)
- aiSuggestions (object: contentGaps, quickWins, improvements)
- qualityScore (number 0-100)
- seoScore (number 0-100)
- readabilityScore (number 0-100)
- engagementScore (number 0-100)`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function updateJobProgress(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  step: string,
  progress: number,
  logger: Logger
) {
  try {
    await supabase.from('jobs').update({
      current_step: step,
      progress,
      status: 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    logger.info(`Progress: ${step} (${progress}%)`);
  } catch (e) {
    logger.warn('Failed to update progress');
  }
}

async function markJobFailed(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  pageId: string,
  errorMessage: string,
  logger: Logger
) {
  try {
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    await supabase.from('pages').update({ status: 'failed' }).eq('id', pageId);

    await supabase.from('activity_log').insert({
      page_id: pageId,
      job_id: jobId,
      type: 'error',
      message: `Failed: ${errorMessage}`,
    });

    logger.error('Job failed', { errorMessage });
  } catch (e) {
    logger.error('Failed to mark job as failed');
  }
}

function deriveKeyword(title: string, slug: string): string {
  let keyword = title
    .replace(/\s*[-|–—]\s*.*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (keyword.length < 10 && slug) {
    keyword = slug.replace(/-/g, ' ').trim();
  }

  return keyword.substring(0, 100);
}

async function fetchPageContent(
  siteUrl: string,
  pageUrl: string,
  username: string,
  applicationPassword: string,
  logger: Logger
): Promise<{ title: string; content: string; postId?: number }> {
  const normalizedUrl = siteUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + btoa(`${username}:${applicationPassword.replace(/\s+/g, '')}`);
  const slug = pageUrl.split('/').filter(Boolean).pop() || '';
  
  // Try posts first
  let apiUrl = `${normalizedUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`;
  logger.info('Fetching page content', { apiUrl });
  
  let response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
      'User-Agent': 'WP-Optimizer-Pro/3.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }

  let posts = await response.json();
  
  // If no posts, try pages
  if (!posts || posts.length === 0) {
    apiUrl = `${normalizedUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`;
    response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'WP-Optimizer-Pro/3.1',
      },
    });
    
    if (response.ok) {
      posts = await response.json();
    }
  }
  
  if (!posts || posts.length === 0) {
    throw new Error('Page not found');
  }

  const post = posts[0];
  return {
    title: post.title?.raw || post.title?.rendered || '',
    content: post.content?.raw || post.content?.rendered || '',
    postId: post.id,
  };
}

async function fetchInternalLinks(
  supabase: ReturnType<typeof createClient>,
  siteId: string | null,
  currentPageId: string,
  logger: Logger
): Promise<InternalLinkCandidate[]> {
  try {
    let query = supabase
      .from('pages')
      .select('url, slug, title')
      .neq('id', currentPageId)
      .limit(100);

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('Failed to fetch internal links');
      return [];
    }

    return (data || []).map(p => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
    }));
  } catch (e) {
    return [];
  }
}

async function fetchNeuronWriterRecommendations(
  supabaseUrl: string,
  supabaseKey: string,
  neuronWriter: NeuronWriterConfig,
  keyword: string,
  language: string,
  logger: Logger,
  jobId: string,
  supabase: ReturnType<typeof createClient>
): Promise<NeuronWriterRecommendations | null> {
  const maxAttempts = 10;
  const pollInterval = 8000;

  logger.info('Fetching NeuronWriter recommendations', { keyword });

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'get-recommendations',
        apiKey: neuronWriter.apiKey,
        projectId: neuronWriter.projectId,
        keyword,
        language: language || 'English',
      }),
    });

    if (!response.ok) {
      logger.warn('NeuronWriter request failed');
      return null;
    }

    let data = await response.json();

    if (data.status === 'ready') {
      return data;
    }

    if (!data.queryId) {
      return null;
    }

    const queryId = data.queryId;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval));
      await updateJobProgress(supabase, jobId, 'waiting_neuronwriter', 25 + attempt * 2, logger);

      const pollResponse = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'get-query',
          apiKey: neuronWriter.apiKey,
          queryId,
        }),
      });

      if (pollResponse.ok) {
        data = await pollResponse.json();
        if (data.status === 'ready' || data.recommendations?.status === 'ready') {
          return data.recommendations || data;
        }
      }
    }

    return null;
  } catch (error) {
    logger.error('NeuronWriter error');
    return null;
  }
}

function buildUserPrompt(
  pageTitle: string,
  pageContent: string,
  keyword: string,
  internalLinks: InternalLinkCandidate[],
  neuronWriter: NeuronWriterRecommendations | null,
  advanced: AdvancedSettings,
  siteContext: SiteContext | undefined
): string {
  const neuronSection = neuronWriter?.status === 'ready' ? `
══════════════════════════════════════════════════════════════════════════
🧠 NEURONWRITER SEO DATA (USE THIS!)
══════════════════════════════════════════════════════════════════════════
Target Word Count: ${neuronWriter.targetWordCount || advanced.minWordCount}
Title Terms: ${neuronWriter.titleTerms || 'N/A'}
H1 Terms: ${neuronWriter.h1Terms || 'N/A'}
H2 Terms: ${neuronWriter.h2Terms || 'N/A'}
Content Terms: ${neuronWriter.contentTerms || 'N/A'}
LSI Keywords: ${neuronWriter.extendedTerms || 'N/A'}
Entities: ${neuronWriter.entities || 'N/A'}

Questions to Answer:
${neuronWriter.questions?.peopleAlsoAsk?.slice(0, 7).map(q => `• ${q}`).join('\n') || ''}
` : '';

  const linksSection = internalLinks.length > 0 ? `
══════════════════════════════════════════════════════════════════════════
🔗 INTERNAL LINKS (USE ONLY THESE URLs!)
══════════════════════════════════════════════════════════════════════════
${internalLinks.slice(0, 40).map(l => `• "${l.title}" → ${l.url}`).join('\n')}

⚠️ ONLY use URLs from this list. DO NOT invent URLs.
` : '';

  return `
╔══════════════════════════════════════════════════════════════════════════╗
║  ⚠️ WORD COUNT REQUIREMENT: ${advanced.minWordCount}-${advanced.maxWordCount} words                    ║
║  This is NON-NEGOTIABLE. Count carefully.                                ║
╚══════════════════════════════════════════════════════════════════════════╝

Transform this content into an EXCEPTIONAL blog post using Alex Hormozi's writing style.

══════════════════════════════════════════════════════════════════════════
📄 ORIGINAL CONTENT
══════════════════════════════════════════════════════════════════════════
Title: ${pageTitle}
Keyword: ${keyword}

CONTENT:
${pageContent.substring(0, 25000)}

${neuronSection}
${linksSection}

══════════════════════════════════════════════════════════════════════════
🏢 CONTEXT
══════════════════════════════════════════════════════════════════════════
Organization: ${siteContext?.organizationName || 'N/A'}
Author: ${siteContext?.authorName || 'Editorial Team'}
Industry: ${siteContext?.industry || 'N/A'}
Audience: ${siteContext?.targetAudience || 'N/A'}

══════════════════════════════════════════════════════════════════════════
📋 CHECKLIST (ALL REQUIRED)
══════════════════════════════════════════════════════════════════════════
✅ ${advanced.minWordCount}+ words in optimizedContent
✅ TL;DR box at top (5 bullets)
✅ 5+ H2s in question format
✅ Expert quote with real attribution
✅ 2-3 Pro tip boxes
✅ 1-2 Warning boxes
✅ Key takeaways box (5 items)
✅ ${advanced.enableFaqs ? '5-7 FAQs' : 'No FAQs'}
✅ ${advanced.enableInternalLinks ? '10+ internal links' : 'No links'}
✅ ${advanced.enableCtas ? '3 CTAs' : 'No CTAs'}
✅ Comparison table
✅ Stat boxes
✅ Hormozi writing style THROUGHOUT`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CALLS WITH TIMEOUT
// ═══════════════════════════════════════════════════════════════════════════════

async function callAIWithTimeout(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger,
  timeoutMs: number = 180000 // 3 minutes
): Promise<{ content: string; tokensUsed: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await callAIProvider(provider, apiKey, model, systemPrompt, userPrompt, logger, controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out after 3 minutes');
    }
    throw error;
  }
}

async function callAIProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger,
  signal?: AbortSignal
): Promise<{ content: string; tokensUsed: number }> {
  logger.info('Calling AI provider', { provider, model });
  const maxTokens = 16000;

  switch (provider) {
    case 'google': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error.substring(0, 500)}`);
      }

      const data = await response.json();
      return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
      };
    }

    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    case 'anthropic': {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.content?.[0]?.text || '',
        tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };
    }

    case 'groq': {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    case 'openrouter': {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wp-optimizer.pro',
          'X-Title': 'WP Optimizer Pro',
        },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROBUST JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseAIResponse(content: string, logger: Logger): OptimizationResult {
  logger.info('Parsing AI response', { length: content.length });
  
  let cleaned = content.trim();
  
  // Remove markdown code fences
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();
// Find JSON bounds const jsonStart = cleaned.indexOf('{'); const jsonEnd = cleaned.lastIndexOf('}');
if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) { logger.error('No JSON object found in response'); throw new Error('No valid JSON found in AI response'); }
cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
// Try to fix common JSON issues try { // Remove trailing commas before } or ] cleaned = cleaned.replace(/,\s*([}]])/g, '$1');
text


// Try parsing
const parsed = JSON.parse(cleaned);

// Validate required fields
if (!parsed.optimizedTitle) {
  throw new Error('Missing optimizedTitle');
}
if (!parsed.optimizedContent) {
  throw new Error('Missing optimizedContent');
}
text


logger.info('Successfully parsed AI response');
return parsed as OptimizationResult;
} catch (e) { logger.error('JSON parse error', { error: e instanceof Error ? e.message : 'Unknown', preview: cleaned.substring(0, 300) });
text


// Last resort: try to extract essential fields
try {
  const titleMatch = cleaned.match(/"optimizedTitle"\s*:\s*"([^"]+)"/);
  const contentMatch = cleaned.match(/"optimizedContent"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/);
  
  if (titleMatch && contentMatch) {
    logger.warn('Using fallback extraction');
    return {
      optimizedTitle: titleMatch
      metaDescription: '',
      h1: titleMatch          h2s: [],
      optimizedContent: contentMatchreplace(/\\n/g, '\n').replace(/\\"/g, '"'),
      contentStrategy: { wordCount: 0, readabilityScore: 0, keywordDensity: 0, lsiKeywords: [] },
      internalLinks: [],
      schema: {},
      aiSuggestions: { contentGaps: '', quickWins: '', improvements: [] },
      qualityScore: 50,
      seoScore: 50,
      readabilityScore: 50,
      engagementScore: 50,
    };
  }
} catch (e2) {
  // Ignore fallback errors
}

throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown'}`);
} }
// ═══════════════════════════════════════════════════════════════════════════════ // QUALITY VALIDATION // ═══════════════════════════════════════════════════════════════════════════════
function validateQuality( result: OptimizationResult, minWordCount: number, logger: Logger ): { valid: boolean; issues: string[]; score: number } { const issues: string[] = []; let score = 100;
const content = result.optimizedContent || ''; const wordCount = content.split(/\s+/).filter(Boolean).length;
// Word count (critical) if (wordCount < minWordCount * 0.8) { issues.push(Word count ${wordCount} is below ${minWordCount}); score -= 40; } else if (wordCount < minWordCount) { issues.push(Word count ${wordCount} slightly below ${minWordCount}); score -= 15; }
// Content blocks if (!content.includes('wp-opt-tldr') && !content.includes('TL;DR')) { issues.push('Missing TL;DR box'); score -= 10; } if (!content.includes('wp-opt-takeaways') && !content.includes('Key Takeaways')) { issues.push('Missing Key Takeaways'); score -= 10; } if (!content.includes('wp-opt-tip') && !content.includes('Pro Tip')) { issues.push('Missing Pro Tips'); score -= 5; } if (!content.includes('<table') && !content.includes('wp-opt-comparison')) { issues.push('Missing comparison table'); score -= 5; }
// H2s const h2Count = (content.match(/<h2/gi) || []).length; if (h2Count < 4) { issues.push(Only ${h2Count} H2s, need 5+); score -= 10; }
// FAQs if (!result.faqs || result.faqs.length < 3) { issues.push('Insufficient FAQs'); score -= 5; }
logger.info('Quality validation', { wordCount, h2Count, score, issues });
return { valid: score >= 50, issues, score: Math.max(0, score), }; }
function calculateFinalScore(result: OptimizationResult, minWordCount: number): number { let score = 50;
const wordCount = result.contentStrategy?.wordCount || result.optimizedContent?.split(/\s+/).filter(Boolean).length || 0;
if (wordCount >= minWordCount) score += 15; else if (wordCount >= minWordCount * 0.9) score += 10;
if (result.tldrSummary?.length >= 4) score += 5; if (result.expertQuote?.quote) score += 5; if (result.faqs?.length >= 5) score += 7; if (result.keyTakeaways?.length >= 5) score += 5; if (result.schema && Object.keys(result.schema).length > 0) score += 5;
const content = result.optimizedContent || ''; if (content.includes('wp-opt-comparison') || content.includes('<table')) score += 3; if (content.includes('wp-opt-tip')) score += 2; if (content.includes('wp-opt-warning')) score += 2;
return Math.min(100, Math.max(0, score)); }
// ═══════════════════════════════════════════════════════════════════════════════ // MAIN SERVE FUNCTION // ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => { if (req.method === 'OPTIONS') { return new Response(null, { headers: corsHeaders }); }
const logger = new Logger('optimize-content-v3.1');
try { const request: OptimizeRequest = await req.json(); const { pageId, siteUrl, username, applicationPassword, aiConfig, neuronWriter, advanced, siteContext } = request;
text


logger.info('Optimization request', { pageId, siteUrl });
text


if (!pageId || !siteUrl || !username || !applicationPassword) {
  return new Response(
    JSON.stringify({ success: false, error: 'Missing required fields' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
text


// Get page
const { data: pageData, error: pageError } = await supabase
  .from('pages')
  .select('*')
  .eq('id', pageId)
  .single();
text


if (pageError || !pageData) {
  return new Response(
    JSON.stringify({ success: false, error: 'Page not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


// Create job
const { data: jobData, error: jobError } = await supabase
  .from('jobs')
  .insert({
    page_id: pageId,
    status: 'running',
    current_step: 'initializing',
    progress: 5,
    started_at: new Date().toISOString(),
  })
  .select()
  .single();
text


if (jobError || !jobData) {
  return new Response(
    JSON.stringify({ success: false, error: 'Failed to create job' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


const jobId = jobData.id;
await supabase.from('pages').update({ status: 'optimizing' }).eq('id', pageId);
text


const settings: AdvancedSettings = {
  targetScore: advanced?.targetScore || 85,
  minWordCount: advanced?.minWordCount || 2000,
  maxWordCount: advanced?.maxWordCount || 3500,
  enableFaqs: advanced?.enableFaqs ?? true,
  enableSchema: advanced?.enableSchema ?? true,
  enableInternalLinks: advanced?.enableInternalLinks ?? true,
  enableToc: advanced?.enableToc ?? true,
  enableKeyTakeaways: advanced?.enableKeyTakeaways ?? true,
  enableCtas: advanced?.enableCtas ?? true,
};
text


try {
  // Step 1: Fetch content
  await updateJobProgress(supabase, jobId, 'fetching_content', 10, logger);
  
  const { title, content } = await fetchPageContent(
    siteUrl,
    pageData.url,
    username,
    applicationPassword,
    logger
  );
text


  if (!content || content.length < 100) {
    throw new Error('Page content is too short');
  }
text


  // Step 2: Get keyword
  const keyword = request.targetKeyword || deriveKeyword(title, pageData.slug);
  logger.info('Keyword', { keyword });
text


  // Step 3: Internal links
  await updateJobProgress(supabase, jobId, 'fetching_sitemap_pages', 20, logger);
  const internalLinks = await fetchInternalLinks(supabase, pageData.site_id, pageId, logger);
text


  // Step 4: NeuronWriter (optional)
  let neuronWriterData: NeuronWriterRecommendations | null = null;
  if (neuronWriter?.enabled && neuronWriter?.apiKey && neuronWriter?.projectId) {
    await updateJobProgress(supabase, jobId, 'fetching_neuronwriter', 25, logger);
    neuronWriterData = await fetchNeuronWriterRecommendations(
      supabaseUrl,
      supabaseKey,
      neuronWriter,
      keyword,
      request.language || 'English',
      logger,
      jobId,
      supabase
    );
  }
text


  // Step 5: Generate content
  await updateJobProgress(supabase, jobId, 'generating_content', 50, logger);
text


  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = buildUserPrompt(
    title,
    content,
    keyword,
    internalLinks,
    neuronWriterData,
    settings,
    siteContext
  );
text


  const provider = aiConfig?.provider || 'google';
  const apiKey = aiConfig?.apiKey || Deno.env.get('GOOGLE_API_KEY') || '';
  const model = aiConfig?.model || 'gemini-2.0-flash';
text


  if (!apiKey) {
    throw new Error('No AI API key configured');
  }
text


  // Call AI with timeout
  const { content: aiResponse, tokensUsed } = await callAIWithTimeout(
    provider,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    logger,
    180000 // 3 minute timeout
  );
text


  logger.info('AI response received', { tokensUsed, length: aiResponse.length });
text


  // Step 6: Parse response
  await updateJobProgress(supabase, jobId, 'processing_response', 80, logger);
  
  let optimization: OptimizationResult;
  try {
    optimization = parseAIResponse(aiResponse, logger);
  } catch (parseError) {
    logger.error('Parse failed, will not retry', { error: parseError instanceof Error ? parseError.message : 'Unknown' });
    throw parseError;
  }
text


  // Step 7: Validate
  await updateJobProgress(supabase, jobId, 'validating_content', 90, logger);
  const validation = validateQuality(optimization, settings.minWordCount, logger);
text


  if (!validation.valid) {
    logger.warn('Quality validation issues', { issues: validation.issues });
  }
text


  // Calculate scores
  const qualityScore = calculateFinalScore(optimization, settings.minWordCount);
  optimization.qualityScore = qualityScore;
  optimization.contentStrategy = optimization.contentStrategy || {
    wordCount: optimization.optimizedContent?.split(/\s+/).filter(Boolean).length || 0,
    readabilityScore: optimization.readabilityScore || 70,
    keywordDensity: 0,
    lsiKeywords: [],
  };
text


  // Step 8: Save
  await updateJobProgress(supabase, jobId, 'saving_results', 95, logger);
text


  await supabase.from('jobs').update({
    status: 'completed',
    progress: 100,
    current_step: 'completed',
    result: optimization,
    ai_tokens_used: tokensUsed,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
text


  await supabase.from('pages').update({
    status: 'completed',
    score_after: {
      overall: qualityScore,
      components: {
        contentDepth: optimization.readabilityScore || 75,
        seoOnPage: optimization.seoScore || 80,
        engagement: optimization.engagementScore || 70,
      },
    },
    word_count: optimization.contentStrategy.wordCount,
    updated_at: new Date().toISOString(),
  }).eq('id', pageId);
text


  await supabase.from('activity_log').insert({
    page_id: pageId,
    job_id: jobId,
    type: 'success',
    message: `Optimized: Score ${qualityScore}, ${optimization.contentStrategy.wordCount} words`,
  });
text


  logger.info('Optimization complete!', { qualityScore, wordCount: optimization.contentStrategy.wordCount });
text


  return new Response(
    JSON.stringify({
      success: true,
      message: 'Optimization completed',
      jobId,
      optimization,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
text


} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Optimization failed', { error: errorMessage });
  await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
  
  return new Response(
    JSON.stringify({ success: false, error: errorMessage, jobId }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
} catch (error) { logger.error('Request error', { error: error instanceof Error ? error.message : 'Unknown' }); return new Response( JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } ); } });
