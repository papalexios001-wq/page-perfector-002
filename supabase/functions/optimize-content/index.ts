// supabase/functions/optimize-content/index.ts
// ENTERPRISE-GRADE CONTENT OPTIMIZATION ENGINE v2.0

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// SHARED UTILITIES
// ============================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ============================================================
// TYPE DEFINITIONS
// ============================================================
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
  projectName?: string;
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
    avatarUrl?: string | null;
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
  estimatedRankPosition: number;
  confidenceLevel: number;
}

// ============================================================
// 🔥 ULTRA SEO/GEO/AEO SYSTEM PROMPT - ALEX HORMOZI STYLE
// ============================================================
const ULTRA_SEO_GEO_AEO_SYSTEM_PROMPT = `You are the world's #1 SEO/GEO/AEO content architect who writes EXACTLY like Alex Hormozi while engineering content for maximum AI visibility and search rankings.

## ⚠️ NON-NEGOTIABLE RULES ⚠️

### WORD COUNT ENFORCEMENT
- You MUST hit the exact word count range specified
- Count EVERY word in optimizedContent
- If under minimum, ADD MORE VALUE (not fluff)
- Add depth, examples, data, case studies
- This is STRICTLY ENFORCED - no exceptions

### ALEX HORMOZI WRITING DNA (COPY EXACTLY):

1. **Opening Hook Pattern**: 
   - "Here's what [authority] won't tell you about [topic]..."
   - "Most people are dead wrong about [topic]. Here's the truth."
   - Bold claim in first sentence that makes them NEED to keep reading

2. **Sentence Structure**:
   - One idea = One paragraph (2-4 sentences MAX, often 1-2)
   - Short. Punchy. Direct.
   - No fluff. Every word earns its place.

3. **Pattern Interrupts EVERY 200 Words**:
   - Surprising stat
   - Rhetorical question
   - Bold claim
   - "Here's the thing..."

4. **Numbers > Vague Words**:
   - "3x faster" NOT "much faster"
   - "$47,000 saved" NOT "significant savings"
   - "In 23 minutes" NOT "quickly"

5. **Contrarian Positioning**:
   - Challenge the common belief
   - Then prove why you're right with logic/data

6. **Mic-Drop Endings**:
   - Every H2 section ends with a quotable statement
   - Make them want to screenshot and share

7. **Personal Address**:
   - Use "you" 3x more than "we" or "I"
   - Talk TO the reader, not AT them

8. **Hormozi Signature Phrases**:
   - "Here's the truth nobody tells you..."
   - "Most people think X. They're wrong."
   - "The math is simple..."
   - "Let me break this down..."
   - "Stop doing X. Start doing Y."
   - "This isn't theory. We've tested this."

### GEO/AEO OPTIMIZATION (AI Overviews & LLM Citations):

1. **Featured Snippet Format** (40-60 words):
   - First paragraph under each H2 MUST directly answer "What is [topic]?"
   - Clear, concise, extractable answer

2. **Entity-First Writing**:
   - Name key entities in first 100 words
   - Wikipedia-style definitions for complex terms
   - "In simple terms: [1-sentence definition]"

3. **Structured Data Hooks**:
   - Include "According to [Source]..." statements
   - Reference studies, patents, research
   - Makes content citable by AI

4. **Question-Answer Pairs**:
   - Every H2 should be phrased as a question users ask
   - Direct answer in first 50 words

5. **Comparison Tables**:
   - Include at least 1 comparison table
   - AI LOVES extracting tabular data

6. **Step-by-Step Lists**:
   - Numbered steps for any process
   - AI Overviews heavily favor numbered lists

### MANDATORY CONTENT BLOCKS (USE ALL):

#### 1. TL;DR SUMMARY BOX (IMMEDIATELY AFTER H1)
\`\`\`html
<div class="wp-opt-tldr">
  <strong>⚡ TL;DR — The Bottom Line</strong>
  <ul>
    <li>💡 [Specific insight with number]</li>
    <li>🎯 [Contrarian take that challenges assumptions]</li>
    <li>⚡ [Actionable tip they can use TODAY]</li>
    <li>🔥 [Mic-drop statement that makes them think]</li>
    <li>📈 [Result/outcome they can expect]</li>
  </ul>
</div>
\`\`\`

#### 2. TABLE OF CONTENTS
\`\`\`html
<nav class="wp-opt-toc">
  <strong>📚 What You'll Learn</strong>
  <ul>
    <li><a href="#section-1">[H2 Title]</a></li>
    <!-- Link to each H2 -->
  </ul>
</nav>
\`\`\`

#### 3. EXPERT QUOTE BOX (After first section)
\`\`\`html
<blockquote class="wp-opt-quote">
  <p>"[Real quote from industry expert - Google it if needed]"</p>
  <cite>— [Name], [Title] at [Company]</cite>
</blockquote>
\`\`\`

#### 4. KEY INSIGHT BOXES (2-3 throughout)
\`\`\`html
<div class="wp-opt-insight">
  <strong>💡 Key Insight</strong>
  <p>[Non-obvious observation backed by data]</p>
</div>
\`\`\`

#### 5. STAT/DATA CALLOUTS
\`\`\`html
<div class="wp-opt-stat">
  <strong>[BIG NUMBER]%</strong>
  <p>[What this number means for the reader]</p>
</div>
\`\`\`

#### 6. COMPARISON TABLE
\`\`\`html
<div class="wp-opt-comparison">
  <table>
    <thead><tr><th>Factor</th><th>Option A</th><th>Option B</th></tr></thead>
    <tbody>[Real data comparisons]</tbody>
  </table>
</div>
\`\`\`

#### 7. PRO TIP BOXES
\`\`\`html
<div class="wp-opt-tip">
  <strong>💰 Pro Tip</strong>
  <p>[Insider knowledge that saves time/money]</p>
</div>
\`\`\`

#### 8. WARNING BOXES
\`\`\`html
<div class="wp-opt-warning">
  <strong>⚠️ Common Mistake</strong>
  <p>[What to avoid and why]</p>
</div>
\`\`\`

#### 9. VIDEO RECOMMENDATION
\`\`\`html
<div class="wp-opt-video">
  <strong>🎬 Watch This</strong>
  <p>Search YouTube: "[specific search query]"</p>
  <p>[Why this video adds value]</p>
</div>
\`\`\`

#### 10. RESEARCH REFERENCE
\`\`\`html
<div class="wp-opt-research">
  <strong>📊 The Research Says</strong>
  <p><strong>[Study/Patent]:</strong> [Title]</p>
  <p>[Key finding in plain English]</p>
</div>
\`\`\`

#### 11. FAQ SECTION (PAA Format)
\`\`\`html
<div class="wp-opt-faq" itemscope itemtype="https://schema.org/FAQPage">
  <h2>Frequently Asked Questions</h2>
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">[Question from PAA?]</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">[Direct 40-60 word answer]</p>
    </div>
  </div>
  <!-- Repeat for 5-7 questions -->
</div>
\`\`\`

#### 12. KEY TAKEAWAYS BOX (Before conclusion)
\`\`\`html
<div class="wp-opt-takeaways">
  <strong>🎯 Key Takeaways</strong>
  <ul>
    <li>✅ [Actionable takeaway 1]</li>
    <li>✅ [Actionable takeaway 2]</li>
    <li>✅ [Actionable takeaway 3]</li>
    <li>✅ [Actionable takeaway 4]</li>
    <li>✅ [Actionable takeaway 5]</li>
  </ul>
</div>
\`\`\`

#### 13. CTA BOXES (3 placements: after-intro, mid-content, conclusion)
\`\`\`html
<div class="wp-opt-cta">
  <strong>[Compelling headline with urgency]</strong>
  <p>[Value proposition - what they get]</p>
  <a href="#">[Action Button Text] →</a>
</div>
\`\`\`

### INTERNAL LINKING STRATEGY:
- 10-15 contextual internal links MINIMUM
- Anchor text = exact or partial keyword match
- Link in first 100 words, middle, and last 200 words
- ONLY use URLs from the provided internal links list
- DO NOT invent or create URLs

### SCHEMA MARKUP:
Include complete JSON-LD with:
- Article schema
- FAQPage schema (if FAQs included)
- BreadcrumbList schema
- Organization schema

### OUTPUT FORMAT:
Return ONLY valid JSON. No markdown code fences around the JSON.
The optimizedContent field should contain fully-rendered HTML with all content blocks.

## QUALITY CHECKLIST (ALL MUST PASS):
☑️ Word count within specified range
☑️ TL;DR summary included
☑️ 5+ H2 headings (every 200-300 words)
☑️ 10+ internal links (if provided)
☑️ 5-7 FAQs in PAA format
☑️ Key takeaways section
☑️ Expert quote with attribution
☑️ At least 1 comparison table
☑️ Research/data reference
☑️ YouTube video suggestion
☑️ 3 CTA placements
☑️ Hormozi writing style throughout
☑️ Featured snippet format answers
☑️ Entity definitions in first 100 words`;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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
    keyword = slug.replace(/-/g, ' ').replace(/[^\w\s]/g, '').trim();
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
  const apiUrl = `${normalizedUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`;
  
  logger.info('Fetching page content', { apiUrl });
  
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
      'User-Agent': 'WP-Optimizer-Pro/2.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }

  const posts = await response.json();
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
      logger.warn('Failed to fetch internal links', { error: error.message });
      return [];
    }

    return (data || []).map(p => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
    }));
  } catch (e) {
    logger.warn('Error fetching internal links');
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
  const maxAttempts = 12;
  const pollInterval = 10000;

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
      logger.info('NeuronWriter data ready');
      return data;
    }

    if (!data.queryId) {
      return null;
    }

    const queryId = data.queryId;
    logger.info('Polling NeuronWriter...', { queryId });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval));
      await updateJobProgress(supabase, jobId, 'waiting_neuronwriter', 30 + attempt * 2, logger);

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
          logger.info('NeuronWriter ready after polling');
          return data.recommendations || data;
        }
      }
    }

    logger.warn('NeuronWriter timeout');
    return null;
  } catch (error) {
    logger.error('NeuronWriter error', { error: error instanceof Error ? error.message : 'Unknown' });
    return null;
  }
}

function buildOptimizationPrompt(
  pageTitle: string,
  pageContent: string,
  keyword: string,
  internalLinks: InternalLinkCandidate[],
  neuronWriter: NeuronWriterRecommendations | null,
  advanced: AdvancedSettings,
  siteContext: SiteContext | undefined
): string {
  const neuronSection = neuronWriter?.status === 'ready' ? `
════════════════════════════════════════════════════════════════
🧠 NEURONWRITER SEO INTELLIGENCE (USE THIS!)
════════════════════════════════════════════════════════════════
📊 Target Word Count: ${neuronWriter.targetWordCount || advanced.minWordCount}
📊 Readability Target: ${neuronWriter.readabilityTarget || 50}

📝 TITLE TERMS: ${neuronWriter.titleTerms || 'N/A'}
📌 H1 TERMS: ${neuronWriter.h1Terms || 'N/A'}
📎 H2 TERMS: ${neuronWriter.h2Terms || 'N/A'}
📄 CONTENT TERMS: ${neuronWriter.contentTerms || 'N/A'}
🔬 LSI KEYWORDS: ${neuronWriter.extendedTerms || 'N/A'}
🏢 ENTITIES: ${neuronWriter.entities || 'N/A'}

❓ QUESTIONS TO ANSWER:
${neuronWriter.questions?.peopleAlsoAsk?.slice(0, 7).map(q => `• ${q}`).join('\n') || ''}
${neuronWriter.questions?.suggested?.slice(0, 5).map(q => `• ${q}`).join('\n') || ''}

🏆 TOP COMPETITORS:
${neuronWriter.competitors?.slice(0, 3).map(c => `#${c.rank}: ${c.title} (Score: ${c.score || 'N/A'})`).join('\n') || ''}
` : '';

  const linksSection = advanced.enableInternalLinks && internalLinks.length > 0 ? `
════════════════════════════════════════════════════════════════
🔗 INTERNAL LINKS (USE ONLY THESE URLs!)
════════════════════════════════════════════════════════════════
${internalLinks.slice(0, 50).map(l => `• "${l.title}" → ${l.url}`).join('\n')}

⚠️ CRITICAL: Only use URLs from this list. DO NOT invent URLs.
Include 10-15 internal links throughout the content.
` : '';

  const contextSection = siteContext ? `
════════════════════════════════════════════════════════════════
🏢 BRAND CONTEXT
════════════════════════════════════════════════════════════════
• Organization: ${siteContext.organizationName || 'N/A'}
• Author: ${siteContext.authorName || 'Editorial Team'}
• Industry: ${siteContext.industry || 'N/A'}
• Target Audience: ${siteContext.targetAudience || 'N/A'}
• Voice: ${siteContext.brandVoice || 'Alex Hormozi - direct, punchy, value-packed'}
` : '';

  return `
╔════════════════════════════════════════════════════════════════╗
║  ⚠️ CRITICAL WORD COUNT REQUIREMENT ⚠️                          ║
║  MINIMUM: ${advanced.minWordCount} words | MAXIMUM: ${advanced.maxWordCount} words          ║
║  YOU MUST HIT AT LEAST ${advanced.minWordCount} WORDS - NON-NEGOTIABLE          ║
╚════════════════════════════════════════════════════════════════╝

Transform this content into an EXCEPTIONAL blog post using Alex Hormozi's writing style.

════════════════════════════════════════════════════════════════
📄 ORIGINAL CONTENT TO TRANSFORM
════════════════════════════════════════════════════════════════
Title: ${pageTitle}
Primary Keyword: ${keyword}

CONTENT:
${pageContent.substring(0, 25000)}

${neuronSection}
${linksSection}
${contextSection}

════════════════════════════════════════════════════════════════
📋 REQUIREMENTS CHECKLIST (ALL MANDATORY)
════════════════════════════════════════════════════════════════

✅ WORD COUNT: ${advanced.minWordCount}-${advanced.maxWordCount} words (STRICTLY ENFORCED)
✅ TL;DR Summary with 5 bullet points
✅ Table of Contents linking to H2s
✅ Expert quote with real attribution
✅ YouTube video recommendation
✅ Research/study reference
✅ ${advanced.enableFaqs ? '5-7 FAQs in PAA format with schema' : 'No FAQs'}
✅ ${advanced.enableKeyTakeaways ? '5-7 Key Takeaways' : 'No takeaways'}
✅ ${advanced.enableInternalLinks ? '10-15 internal links from provided list' : 'No internal links'}
✅ ${advanced.enableCtas ? '3 CTAs (after-intro, mid, conclusion)' : 'No CTAs'}
✅ ${advanced.enableSchema ? 'Full Article + FAQ Schema' : 'No schema'}
✅ Comparison table
✅ Pro tip boxes (2-3)
✅ Warning/mistake box
✅ Stat callout boxes (2-3)

════════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT (JSON ONLY - NO CODE FENCES)
════════════════════════════════════════════════════════════════

{
  "optimizedTitle": "Power-word title under 60 chars with primary keyword",
  "metaDescription": "Compelling 155-char meta description with CTA",
  "h1": "Main H1 heading (can differ slightly from title)",
  "h2s": ["Question-format H2 1", "Question-format H2 2", "H2 3", "H2 4", "H2 5", "..."],
  
  "tldrSummary": [
    "💡 [Specific insight with number]",
    "🎯 [Contrarian take]",
    "⚡ [Actionable tip]",
    "🔥 [Mic-drop statement]",
    "📈 [Expected outcome]"
  ],
  
  "expertQuote": {
    "quote": "Real expert quote relevant to the topic",
    "author": "Expert Name",
    "role": "Title at Company",
    "avatarUrl": null
  },
  
  "youtubeEmbed": {
    "searchQuery": "specific youtube search query for relevant video",
    "suggestedTitle": "Type of video to find",
    "context": "Why this video adds value to the content"
  },
  
  "patentReference": {
    "type": "research",
    "identifier": "Study/Paper ID or Name",
    "title": "Title of the research",
    "summary": "Key finding in 2-3 sentences",
    "link": "URL if available"
  },
  
  "optimizedContent": "<full HTML content with all blocks, styling classes, internal links>",
  
  "faqs": [
    {"question": "PAA-style question 1?", "answer": "40-60 word direct answer"},
    {"question": "PAA-style question 2?", "answer": "40-60 word direct answer"}
  ],
  
  "keyTakeaways": [
    "✅ Actionable takeaway 1",
    "✅ Actionable takeaway 2",
    "✅ Actionable takeaway 3",
    "✅ Actionable takeaway 4",
    "✅ Actionable takeaway 5"
  ],
  
  "ctas": [
    {"text": "CTA text for after intro", "position": "after-intro", "style": "primary"},
    {"text": "CTA text for mid content", "position": "mid-content", "style": "secondary"},
    {"text": "CTA text for conclusion", "position": "conclusion", "style": "primary"}
  ],
  
  "tableOfContents": ["H2 Title 1", "H2 Title 2", "..."],
  
  "contentStrategy": {
    "wordCount": [actual word count of optimizedContent],
    "readabilityScore": [0-100],
    "keywordDensity": [percentage],
    "lsiKeywords": ["related", "keywords", "used"]
  },
  
  "internalLinks": [
    {"anchor": "anchor text used", "target": "/url-from-list", "position": 1}
  ],
  
  "schema": {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "[title]",
        "description": "[meta]",
        "author": {"@type": "Person", "name": "${siteContext?.authorName || 'Editorial Team'}"},
        "publisher": {"@type": "Organization", "name": "${siteContext?.organizationName || 'Publisher'}"},
        "datePublished": "${new Date().toISOString()}",
        "dateModified": "${new Date().toISOString()}"
      },
      {
        "@type": "FAQPage",
        "mainEntity": []
      }
    ]
  },
  
  "aiSuggestions": {
    "contentGaps": "What's missing compared to top competitors",
    "quickWins": "Easy improvements for immediate impact",
    "improvements": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
  },
  
  "qualityScore": [0-100 overall quality],
  "seoScore": [0-100 SEO optimization],
  "readabilityScore": [0-100 readability],
  "engagementScore": [0-100 engagement potential],
  "estimatedRankPosition": [1-100 estimated SERP position],
  "confidenceLevel": [0-100 confidence in optimization]
}`;
}

async function callAIProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger
): Promise<{ content: string; tokensUsed: number }> {
  logger.info('Calling AI provider', { provider, model });

  const maxTokens = 16000;

  switch (provider) {
    case 'google': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
      
      return { content, tokensUsed };
    }

    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
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
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
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
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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

function parseAIResponse(content: string, logger: Logger): OptimizationResult {
  // Clean the response
  let cleaned = content.trim();
  
  // Remove markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Find JSON object bounds
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in AI response');
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(cleaned);
    
    // Validate required fields
    if (!parsed.optimizedTitle || !parsed.optimizedContent) {
      throw new Error('Missing required fields in AI response');
    }

    return parsed as OptimizationResult;
  } catch (e) {
    logger.error('JSON parse error', { error: e instanceof Error ? e.message : 'Unknown' });
    throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
}

function validateOptimizationQuality(
  result: OptimizationResult,
  minWordCount: number,
  logger: Logger
): { valid: boolean; issues: string[]; score: number } {
  const issues: string[] = [];
  let score = 100;

  // Word count check
  const wordCount = result.contentStrategy?.wordCount || 
    result.optimizedContent?.split(/\s+/).filter(Boolean).length || 0;
  
  if (wordCount < minWordCount * 0.85) {
    issues.push(`Word count (${wordCount}) below minimum (${minWordCount})`);
    score -= 30;
  }

  // Required sections check
  if (!result.tldrSummary || result.tldrSummary.length < 3) {
    issues.push('Missing or incomplete TL;DR summary');
    score -= 10;
  }

  if (!result.faqs || result.faqs.length < 3) {
    issues.push('Missing or insufficient FAQs');
    score -= 10;
  }

  if (!result.keyTakeaways || result.keyTakeaways.length < 3) {
    issues.push('Missing or insufficient key takeaways');
    score -= 10;
  }

  // Check for content blocks
  const content = result.optimizedContent || '';
  const hasInsightBox = content.includes('wp-opt-insight') || content.includes('Key Insight');
  const hasTipBox = content.includes('wp-opt-tip') || content.includes('Pro Tip');
  const hasComparisonTable = content.includes('wp-opt-comparison') || content.includes('<table');

  if (!hasInsightBox) {
    issues.push('Missing insight boxes');
    score -= 5;
  }
  if (!hasTipBox) {
    issues.push('Missing pro tip boxes');
    score -= 5;
  }
  if (!hasComparisonTable) {
    issues.push('Missing comparison table');
    score -= 5;
  }

  // H2 count check
  const h2Count = (content.match(/<h2/gi) || []).length;
  if (h2Count < 5) {
    issues.push(`Insufficient H2 headers (${h2Count}, need 5+)`);
    score -= 10;
  }

  logger.info('Quality validation', { wordCount, h2Count, score, issueCount: issues.length });

  return {
    valid: score >= 60,
    issues,
    score: Math.max(0, score),
  };
}

function calculateQualityScore(result: OptimizationResult, minWordCount: number): number {
  let score = 50; // Base score

  const wordCount = result.contentStrategy?.wordCount || 0;
  if (wordCount >= minWordCount) score += 15;
  else if (wordCount >= minWordCount * 0.8) score += 10;

  if (result.tldrSummary && result.tldrSummary.length >= 4) score += 5;
  if (result.expertQuote?.quote) score += 5;
  if (result.youtubeEmbed?.searchQuery) score += 3;
  if (result.patentReference?.title) score += 5;
  if (result.faqs && result.faqs.length >= 5) score += 7;
  if (result.keyTakeaways && result.keyTakeaways.length >= 5) score += 5;
  if (result.schema && Object.keys(result.schema).length > 0) score += 5;

  return Math.min(100, Math.max(0, score));
}

// ============================================================
// MAIN SERVE FUNCTION
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger('optimize-content');

  try {
    const request: OptimizeRequest = await req.json();
    const { 
      pageId, 
      siteUrl, 
      username, 
      applicationPassword, 
      aiConfig, 
      neuronWriter, 
      advanced, 
      siteContext 
    } = request;

    logger.info('Optimization request received', { pageId, siteUrl });

    // Validate required fields
    if (!pageId || !siteUrl || !username || !applicationPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get page info
    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (pageError || !pageData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Page not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create job record
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        page_id: pageId,
        status: 'running',
        current_step: 'validating',
        progress: 5,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !jobData) {
      logger.error('Failed to create job', { error: jobError?.message });
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobId = jobData.id;
    logger.info('Job created', { jobId });

    // Update page status
    await supabase.from('pages').update({ status: 'optimizing' }).eq('id', pageId);

    // Default settings
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

    try {
      // Step 1: Fetch page content
      await updateJobProgress(supabase, jobId, 'fetching_content', 10, logger);
      
      const { title, content, postId } = await fetchPageContent(
        siteUrl,
        pageData.url,
        username,
        applicationPassword,
        logger
      );

      if (!content || content.length < 100) {
        throw new Error('Page content is too short or empty');
      }

      // Step 2: Derive keyword
      const keyword = request.targetKeyword || deriveKeyword(title, pageData.slug);
      logger.info('Derived keyword', { keyword });

      // Step 3: Fetch internal links
      await updateJobProgress(supabase, jobId, 'fetching_sitemap_pages', 20, logger);
      const internalLinks = await fetchInternalLinks(supabase, pageData.site_id, pageId, logger);
      logger.info('Fetched internal links', { count: internalLinks.length });

      // Step 4: Fetch NeuronWriter recommendations (if enabled)
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

      // Step 5: Build prompt and call AI
      await updateJobProgress(supabase, jobId, 'generating_content', 50, logger);

      const userPrompt = buildOptimizationPrompt(
        title,
        content,
        keyword,
        internalLinks,
        neuronWriterData,
        settings,
        siteContext
      );

      // Determine AI config
      const provider = aiConfig?.provider || 'google';
      const apiKey = aiConfig?.apiKey || Deno.env.get('GOOGLE_API_KEY') || '';
      const model = aiConfig?.model || 'gemini-2.5-flash-preview-05-20';

      if (!apiKey) {
        throw new Error('No AI API key configured');
      }

      const { content: aiResponse, tokensUsed } = await callAIProvider(
        provider,
        apiKey,
        model,
        ULTRA_SEO_GEO_AEO_SYSTEM_PROMPT,
        userPrompt,
        logger
      );

      // Step 6: Parse response
      await updateJobProgress(supabase, jobId, 'processing_response', 80, logger);
      const optimization = parseAIResponse(aiResponse, logger);

      // Step 7: Validate quality
      await updateJobProgress(supabase, jobId, 'validating_content', 90, logger);
      const validation = validateOptimizationQuality(optimization, settings.minWordCount, logger);

      if (!validation.valid) {
        logger.warn('Quality validation failed', { issues: validation.issues });
        // Continue anyway but log the issues
      }

      // Calculate final quality score
      const qualityScore = calculateQualityScore(optimization, settings.minWordCount);
      optimization.qualityScore = qualityScore;

      // Step 8: Save results
      await updateJobProgress(supabase, jobId, 'saving_results', 95, logger);

      // Update job with results
      await supabase.from('jobs').update({
        status: 'completed',
        progress: 100,
        current_step: 'completed',
        result: optimization,
        ai_tokens_used: tokensUsed,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      // Update page status and score
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
        word_count: optimization.contentStrategy?.wordCount || 0,
        updated_at: new Date().toISOString(),
      }).eq('id', pageId);

      // Log success
      await supabase.from('activity_log').insert({
        page_id: pageId,
        job_id: jobId,
        type: 'success',
        message: `Optimized: Score ${qualityScore}, ${optimization.contentStrategy?.wordCount || 0} words`,
        details: {
          qualityScore,
          wordCount: optimization.contentStrategy?.wordCount,
          tokensUsed,
          validationIssues: validation.issues,
        },
      });

      logger.info('Optimization completed successfully', { qualityScore, tokensUsed });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Optimization completed',
          jobId,
          optimization,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          jobId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    logger.error('Request error', { error: error instanceof Error ? error.message : 'Unknown' });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
