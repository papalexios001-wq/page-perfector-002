import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Logger,
  withRetry,
  corsHeaders,
  AppError,
  createErrorResponse,
  validateRequired,
  checkRateLimit,
} from "../_shared/utils.ts";

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
  termsDetailed?: {
    title: Array<{ t: string; usage_pc: number }>;
    content: Array<{ t: string; usage_pc: number; sugg_usage?: [number, number] }>;
    entities: Array<{ t: string; importance: number; relevance: number; confidence: number }>;
  };
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

// ============================================================
// ULTRA-HIGH-QUALITY ALEX HORMOZI STYLE SYSTEM PROMPT
// ============================================================
const HORMOZI_STYLE_SYSTEM_PROMPT = `You are the world's #1 SEO content strategist who writes EXACTLY like Alex Hormozi - direct, punchy, value-packed, and impossible to stop reading.

## ⚠️ CRITICAL WORD COUNT REQUIREMENT ⚠️
You MUST generate content that meets the EXACT word count specified. This is NON-NEGOTIABLE.
- Count every word in your optimizedContent field
- If asked for 2500-3000 words, you MUST deliver AT LEAST 2500 words
- Pad with MORE value, MORE examples, MORE sections if needed
- NEVER deliver less than the minimum word count

## ALEX HORMOZI WRITING STYLE (FOLLOW EXACTLY):

### Voice & Tone:
1. **Short, punchy sentences.** No fluff. Every word earns its place.
2. **Bold claims backed by logic.** Make readers think "damn, that's true."
3. **Contrarian takes.** Challenge conventional wisdom. Say what others won't.
4. **Pattern interrupts every 2-3 paragraphs.** Unexpected statements keep readers hooked.
5. **Conversational but authoritative.** Like a smart friend 10 years ahead explaining something important.
6. **Use "you" constantly.** Make it personal. Talk TO the reader, not AT them.
7. **Number-driven.** "3x faster" not "much faster". "47% increase" not "significant improvement".
8. **Mic-drop endings.** Every section ends with a quotable statement.
9. **Analogies everywhere.** Complex = simple comparisons.
10. **One idea per paragraph.** Scannable. Respect their time.

### Hormozi Phrases to Use:
- "Here's the truth nobody tells you..."
- "Most people think X. They're wrong. Here's why..."
- "This isn't theory. We've tested this on [number] [things]. It works."
- "Let me break this down..."
- "The math is simple..."
- "Here's the thing..."
- "Stop doing X. Start doing Y."
- "The difference between [good] and [great] is..."

### Content Structure:
- Hook in first 2 sentences (pattern interrupt or bold claim)
- Value proposition by paragraph 2
- H2 every 200-300 words MAXIMUM
- Bullet points for 3+ items (NEVER inline lists)
- Bold 1-2 key phrases per paragraph
- Short paragraphs (2-4 sentences max, often 1-2)

## SEO/GEO/AEO OPTIMIZATION:
- Featured snippet format (40-60 word direct answers)
- PAA-style Q&A sections (5-7 questions)
- Entity-first writing (key entities in first 100 words)
- E-E-A-T signals throughout
- Voice search optimization
- AI Overview optimization

## OUTPUT RULES:
- Return ONLY valid JSON
- NO markdown code fences in the JSON
- HTML in optimizedContent must be semantic and styled
- Include ALL required sections`;

// Helper functions
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
    logger.info(`Job progress: ${step} (${progress}%)`);
  } catch (e) {
    logger.warn('Failed to update job progress', { error: e instanceof Error ? e.message : 'Unknown' });
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
      details: { requestId: logger.getRequestId() },
    });

    logger.error('Job marked as failed', { jobId, pageId, errorMessage });
  } catch (e) {
    logger.error('Failed to mark job as failed', { error: e instanceof Error ? e.message : 'Unknown' });
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

  logger.info('Creating NeuronWriter query', { keyword, projectId: neuronWriter.projectId });

  try {
    const createResponse = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'get-recommendations',
        apiKey: neuronWriter.apiKey,
        projectId: neuronWriter.projectId,
        keyword: keyword,
        language: language || 'English',
      }),
    });

    if (!createResponse.ok) {
      logger.warn('NeuronWriter initial request failed', { status: createResponse.status });
      return null;
    }

    let data = await createResponse.json();

    if (data.status === 'ready') {
      logger.info('NeuronWriter data ready immediately');
      return data;
    }

    if (!data.queryId) {
      logger.warn('NeuronWriter did not return queryId');
      return null;
    }

    const queryId = data.queryId;
    logger.info('NeuronWriter query created, polling...', { queryId });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval));
      await updateJobProgress(supabase, jobId, 'waiting_neuronwriter', 30 + attempt, logger);

      const pollResponse = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'get-recommendations',
          apiKey: neuronWriter.apiKey,
          projectId: neuronWriter.projectId,
          queryId: queryId,
        }),
      });

      if (pollResponse.ok) {
        data = await pollResponse.json();
        if (data.status === 'ready') {
          logger.info('NeuronWriter data ready after polling', { attempt });
          return data;
        }
      }

      logger.info('NeuronWriter still processing', { attempt, status: data.status });
    }

    logger.warn('NeuronWriter timed out after max attempts');
    return null;
  } catch (error) {
    logger.error('NeuronWriter fetch error', { error: error instanceof Error ? error.message : 'Unknown' });
    return null;
  }
}

function buildOptimizationPrompt(
  pageTitle: string,
  pageContent: string,
  keyword: string,
  internalLinkCandidates: InternalLinkCandidate[],
  neuronWriterData: NeuronWriterRecommendations | null,
  advanced: AdvancedSettings,
  siteContext: SiteContext | undefined
): string {
  const neuronWriterSection = neuronWriterData?.status === 'ready' ? `
═══════════════════════════════════════════════════════════════
🧠 NEURONWRITER SEO INTELLIGENCE (USE THIS DATA!)
═══════════════════════════════════════════════════════════════
📊 TARGET METRICS:
- Recommended Word Count: ${neuronWriterData.targetWordCount || 'N/A'}
- Readability Target: ${neuronWriterData.readabilityTarget || 'N/A'}

📝 TITLE TERMS: ${neuronWriterData.titleTerms || 'N/A'}
📌 H1 TERMS: ${neuronWriterData.h1Terms || 'N/A'}
📎 H2 TERMS: ${neuronWriterData.h2Terms || 'N/A'}
📄 CONTENT TERMS: ${neuronWriterData.contentTerms || 'N/A'}
🔬 LSI KEYWORDS: ${neuronWriterData.extendedTerms || 'N/A'}
🏢 ENTITIES: ${neuronWriterData.entities || 'N/A'}

❓ QUESTIONS TO ANSWER:
${neuronWriterData.questions?.suggested?.slice(0, 7).join('\n') || 'N/A'}
${neuronWriterData.questions?.peopleAlsoAsk?.slice(0, 5).join('\n') || ''}
` : '';

  const internalLinksSection = advanced.enableInternalLinks && internalLinkCandidates.length > 0 ? `
═══════════════════════════════════════════════════════════════
🔗 INTERNAL LINKS (ONLY USE THESE URLs!)
═══════════════════════════════════════════════════════════════
${internalLinkCandidates.slice(0, 50).map(l => `- "${l.title}" → ${l.url}`).join('\n')}

⚠️ CRITICAL: ONLY link to URLs from this list. Do NOT invent URLs.
` : '';

  const siteContextSection = siteContext ? `
═══════════════════════════════════════════════════════════════
🏢 BRAND CONTEXT
═══════════════════════════════════════════════════════════════
- Organization: ${siteContext.organizationName || 'N/A'}
- Industry: ${siteContext.industry || 'N/A'}
- Target Audience: ${siteContext.targetAudience || 'N/A'}
- Brand Voice: ${siteContext.brandVoice || 'Alex Hormozi style'}
` : '';

  return `
╔═══════════════════════════════════════════════════════════════╗
║  ⚠️ CRITICAL WORD COUNT REQUIREMENT ⚠️                        ║
║  MINIMUM: ${advanced.minWordCount} words | MAXIMUM: ${advanced.maxWordCount} words       ║
║  YOU MUST HIT AT LEAST ${advanced.minWordCount} WORDS OR THE OUTPUT IS INVALID   ║
╚═══════════════════════════════════════════════════════════════╝

Transform this content into an EXCEPTIONAL, HIGH-VALUE blog post using Alex Hormozi's writing style.

═══════════════════════════════════════════════════════════════
📄 ORIGINAL CONTENT TO TRANSFORM
═══════════════════════════════════════════════════════════════
Title: ${pageTitle}
Primary Keyword: ${keyword}

CURRENT CONTENT:
${pageContent.substring(0, 20000)}

${neuronWriterSection}
${internalLinksSection}
${siteContextSection}

═══════════════════════════════════════════════════════════════
📋 MANDATORY REQUIREMENTS (ALL MUST BE INCLUDED)
═══════════════════════════════════════════════════════════════

🎯 WORD COUNT: ${advanced.minWordCount}-${advanced.maxWordCount} words (STRICTLY ENFORCED)
   - You MUST write AT LEAST ${advanced.minWordCount} words
   - Add more sections, examples, and depth if needed
   - This is NON-NEGOTIABLE

📝 CONTENT BLOCKS TO INCLUDE:
1. TL;DR Summary (4-5 punchy bullet points at TOP)
2. Expert Quote (real industry quote with attribution)
3. YouTube Video suggestion (search query + context)
4. Research/Patent Reference (cite academic source)
5. ${advanced.enableFaqs ? '5-7 FAQs in PAA format' : 'No FAQs'}
6. ${advanced.enableKeyTakeaways ? '5-7 Key Takeaways at end' : 'No takeaways'}
7. ${advanced.enableToc ? 'Table of Contents' : 'No TOC'}
8. ${advanced.enableInternalLinks ? '10-15 internal links from provided list' : 'No internal links'}
9. ${advanced.enableCtas ? '3 CTAs (after intro, mid-content, conclusion)' : 'No CTAs'}
10. ${advanced.enableSchema ? 'Article + FAQ Schema markup' : 'No schema'}

✍️ WRITING REQUIREMENTS:
- Write EXACTLY like Alex Hormozi
- Every paragraph delivers value
- Use specific numbers and data
- Include real-world examples
- Make it impossible to stop reading
- Bold key phrases (1-2 per paragraph)
- H2 headers every 200-300 words MAX

═══════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT (RETURN ONLY THIS JSON STRUCTURE)
═══════════════════════════════════════════════════════════════
{
  "optimizedTitle": "Power-word title under 60 chars with keyword",
  "metaDescription": "Compelling 155-char meta with CTA",
  "h1": "Main H1 (can differ from title)",
  "h2s": ["H2 1", "H2 2", "H2 3", "H2 4", "H2 5", "..."],
  
  "tldrSummary": [
    "💡 Key insight 1 with specific number",
    "🎯 Key insight 2 - contrarian take",
    "⚡ Key insight 3 - actionable",
    "🔥 Key insight 4 - mic-drop statement"
  ],
  
  "expertQuote": {
    "quote": "Compelling expert quote relevant to topic",
    "author": "Expert Name",
    "role": "Title at Company",
    "avatarUrl": null
  },
  
  "youtubeEmbed": {
    "searchQuery": "specific youtube search query",
    "suggestedTitle": "Type of video to embed",
    "context": "Why this video adds value"
  },
  
  "patentReference": {
    "type": "research",
    "identifier": "DOI or Patent Number",
    "title": "Research/Patent Title",
    "summary": "2-sentence relevance summary",
    "link": "https://..."
  },
  
  "optimizedContent": "<article class='prose prose-lg max-w-none'>
    <div class='tldr-box bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-l-4 border-blue-500 p-6 rounded-r-xl my-8'>
      <h3 class='text-lg font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2'>⚡ TL;DR - The Bottom Line</h3>
      <ul class='space-y-2 text-gray-700 dark:text-gray-300'>
        <li>💡 Point 1</li>
        <li>🎯 Point 2</li>
        <li>⚡ Point 3</li>
        <li>🔥 Point 4</li>
      </ul>
    </div>
    
    <p class='text-xl leading-relaxed'><strong>Hook sentence that grabs attention.</strong> Second sentence that delivers on the hook.</p>
    
    <h2 class='text-2xl font-bold mt-10 mb-4'>First Major Section</h2>
    <p>Content with <strong>bold key phrases</strong> and value...</p>
    
    <blockquote class='expert-quote bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-amber-500 p-6 rounded-r-xl my-8 italic'>
      <p class='text-lg'>"Expert quote here"</p>
      <footer class='mt-3 text-sm font-semibold'>— Expert Name, Title</footer>
    </blockquote>
    
    <div class='key-takeaways bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-l-4 border-emerald-500 p-6 rounded-r-xl my-8'>
      <h3 class='text-lg font-bold text-emerald-700 dark:text-emerald-300 mb-3'>🎯 Key Takeaways</h3>
      <ul class='space-y-2'>
        <li>✅ Takeaway 1</li>
        <li>✅ Takeaway 2</li>
      </ul>
    </div>
    
    <div class='faq-section my-8'>
      <h2 class='text-2xl font-bold mb-6'>Frequently Asked Questions</h2>
      <div class='space-y-4'>
        <details class='bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4'>
          <summary class='font-semibold cursor-pointer'>Question 1?</summary>
          <p class='mt-3 text-gray-600 dark:text-gray-400'>Answer...</p>
        </details>
      </div>
    </div>
  </article>",
  
  "contentStrategy": {
    "wordCount": ${advanced.minWordCount},
    "readabilityScore": 72,
    "keywordDensity": 1.5,
    "lsiKeywords": ["term1", "term2"],
    "hormoziStyleScore": 90,
    "entitiesCovered": ["entity1", "entity2"]
  },
  
  "internalLinks": [
    {"anchor": "text", "target": "https://...", "context": "sentence"}
  ],
  
  "schema": { "@context": "https://schema.org", "@type": "Article", "..." },
  
  "faqs": [
    {"question": "Q1?", "answer": "A1"},
    {"question": "Q2?", "answer": "A2"}
  ],
  
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  
  "ctas": [
    {"text": "CTA text", "position": "after-intro", "style": "primary"}
  ],
  
  "tableOfContents": ["Section 1", "Section 2"],
  
  "qualityScore": 92,
  "seoScore": 90,
  "readabilityScore": 75,
  "engagementScore": 88
}

⚠️ REMEMBER: Your optimizedContent MUST contain AT LEAST ${advanced.minWordCount} words. Count them!`;
}

function convertMarkdownToHtml(content: string): string {
  if (!content) return content;

  let html = content;
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold mt-6 mb-3">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-8 mb-4">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-10 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-12 mb-6">$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-2 my-4">$&</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  return html;
}

function validateInternalLinks(content: string, validUrlSet: Set<string>, logger: Logger): string {
  if (!content) return content;

  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  let invalidCount = 0;
  let result = content;

  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[1];
    if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) continue;

    if (href.startsWith('http://') || href.startsWith('https://')) {
      if (!validUrlSet.has(href)) {
        const slug = href.split('/').pop()?.replace(/\/$/, '') || '';
        if (!validUrlSet.has(slug)) {
          result = result.replace(match[0], `<!-- removed invalid link: ${href} --><span`);
          invalidCount++;
        }
      }
    }
  }

  if (invalidCount > 0) {
    logger.warn('Removed invalid internal links', { count: invalidCount });
  }

  return result;
}

const escapeNewlinesInJsonStrings = (s: string): string => {
  let inString = false;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString;
    if (inString && c === '\n') out += '\\n';
    else if (inString && c === '\r') { /* skip */ }
    else if (inString && c === '\t') out += '\\t';
    else out += c;
  }
  return out;
};

const repairJsonStringForParsing = (raw: string): string => {
  let s = raw.replace(/\r/g, '');
  s = s.replace(/="([^"]*)"/g, "='$1'");
  s = escapeNewlinesInJsonStrings(s);
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
};

// ============================================================
// BACKGROUND JOB PROCESSOR
// ============================================================
async function processOptimizationJob(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  lovableApiKey: string | undefined,
  jobId: string,
  pageId: string,
  request: OptimizeRequest,
  logger: Logger
) {
  const { siteUrl, username, applicationPassword, targetKeyword, language, aiConfig, neuronWriter, advanced, siteContext } = request;

  const effectiveAdvanced: AdvancedSettings = {
    targetScore: advanced?.targetScore ?? 85,
    minWordCount: advanced?.minWordCount ?? 2500,
    maxWordCount: advanced?.maxWordCount ?? 3500,
    enableFaqs: advanced?.enableFaqs ?? true,
    enableSchema: advanced?.enableSchema ?? true,
    enableInternalLinks: advanced?.enableInternalLinks ?? true,
    enableToc: advanced?.enableToc ?? true,
    enableKeyTakeaways: advanced?.enableKeyTakeaways ?? true,
    enableCtas: advanced?.enableCtas ?? true,
  };

  try {
    const useUserAI = aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model;

    if (!useUserAI && !lovableApiKey) {
      throw new Error('No AI provider configured.');
    }

    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (pageError || !pageData) {
      throw new Error('Page not found in database');
    }

    await updateJobProgress(supabase, jobId, 'fetching_sitemap_pages', 15, logger);

    const { data: allPages } = await supabase
      .from('pages')
      .select('url, slug, title')
      .neq('id', pageId)
      .limit(200);

    const internalLinkCandidates: InternalLinkCandidate[] = (allPages || []).map((p: { url: string; slug: string; title: string }) => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
    }));

    const validUrlSet = new Set<string>();
    internalLinkCandidates.forEach(l => {
      validUrlSet.add(l.url);
      validUrlSet.add(l.slug);
    });

    logger.info('Fetched internal link candidates', { count: internalLinkCandidates.length });

    await updateJobProgress(supabase, jobId, 'fetching_wordpress', 20, logger);

    let normalizedUrl = siteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    const authHeader = 'Basic ' + btoa(`${username}:${applicationPassword.replace(/\s+/g, '')}`);

    let pageContent = '';
    let pageTitle = pageData.title;

    if (pageData.post_id) {
      try {
        const wpResponse = await withRetry(
          () => fetch(
            `${normalizedUrl}/wp-json/wp/v2/posts/${pageData.post_id}?context=edit`,
            {
              headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
                'User-Agent': 'WP-Optimizer-Pro/2.0',
              },
            }
          ),
          { maxRetries: 2, initialDelayMs: 500, retryableStatuses: [408, 429, 500, 502, 503, 504] }
        );

        if (wpResponse.ok) {
          const wpData = await wpResponse.json();
          pageContent = wpData.content?.raw || wpData.content?.rendered || '';
          pageTitle = wpData.title?.raw || wpData.title?.rendered || pageTitle;
          logger.info('Fetched WP content', { chars: pageContent.length });
        }
      } catch (e) {
        logger.warn('Could not fetch WP content', { error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    const effectiveKeyword = targetKeyword || deriveKeyword(pageTitle, pageData.slug);
    logger.info('Using keyword', { keyword: effectiveKeyword });

    await updateJobProgress(supabase, jobId, 'fetching_neuronwriter', 30, logger);

    let neuronWriterData: NeuronWriterRecommendations | null = null;
    if (neuronWriter?.enabled && neuronWriter?.apiKey && neuronWriter?.projectId) {
      neuronWriterData = await fetchNeuronWriterRecommendations(
        supabaseUrl,
        supabaseKey,
        neuronWriter,
        effectiveKeyword,
        language || 'English',
        logger,
        jobId,
        supabase
      );
    }

    await updateJobProgress(supabase, jobId, 'analyzing_content', 40, logger);

    const userPrompt = buildOptimizationPrompt(
      pageTitle,
      pageContent,
      effectiveKeyword,
      internalLinkCandidates,
      neuronWriterData,
      effectiveAdvanced,
      siteContext
    );

    await updateJobProgress(supabase, jobId, 'generating_content', 50, logger);

    const messages = [
      { role: 'system', content: HORMOZI_STYLE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    interface AIRequest {
      url: string;
      headers: Record<string, string>;
      body: string;
    }

    const buildAIRequest = (): AIRequest => {
      if (useUserAI && aiConfig) {
        const { provider, apiKey, model } = aiConfig;

        switch (provider) {
          case 'google':
            return {
              url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${HORMOZI_STYLE_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 100000 },
              }),
            };

          case 'openai':
            return {
              url: 'https://api.openai.com/v1/chat/completions',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 16384 }),
            };

          case 'anthropic':
            return {
              url: 'https://api.anthropic.com/v1/messages',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model, system: HORMOZI_STYLE_SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }], max_tokens: 16384 }),
            };

          case 'groq':
            return {
              url: 'https://api.groq.com/openai/v1/chat/completions',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 32000 }),
            };

          case 'openrouter':
            return {
              url: 'https://openrouter.ai/api/v1/chat/completions',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://wp-optimizer-pro.lovable.app',
                'X-Title': 'WP Optimizer Pro',
              },
              body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 100000 }),
            };

          default:
            throw new Error(`Unsupported AI provider: ${provider}`);
        }
      }

      return {
        url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableApiKey}` },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, temperature: 0.7, max_tokens: 100000 }),
      };
    };

    const aiRequest = buildAIRequest();

    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 360000); // 6 minutes

    let aiResponse: Response;
    try {
      aiResponse = await withRetry(
        () => fetch(aiRequest.url, {
          method: 'POST',
          headers: aiRequest.headers,
          body: aiRequest.body,
          signal: aiController.signal,
        }),
        { maxRetries: 2, initialDelayMs: 3000, retryableStatuses: [429, 500, 502, 503, 504] }
      );
      clearTimeout(aiTimeoutId);
    } catch (aiErr) {
      clearTimeout(aiTimeoutId);
      if (aiErr instanceof Error && aiErr.name === 'AbortError') {
        throw new Error('AI request timed out after 360 seconds.');
      }
      throw aiErr;
    }

    await updateJobProgress(supabase, jobId, 'processing_response', 80, logger);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error('AI error', { status: aiResponse.status, body: errorText.substring(0, 500) });

      if (aiResponse.status === 429) throw new Error('Rate limited. Please wait and try again.');
      if (aiResponse.status === 402) throw new Error('Insufficient credits.');

      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();

    let aiContent: string | undefined;
    if (useUserAI && aiConfig?.provider === 'google') {
      aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (useUserAI && aiConfig?.provider === 'anthropic') {
      aiContent = aiData.content?.[0]?.text;
    } else {
      aiContent = aiData.choices?.[0]?.message?.content;
    }

    if (!aiContent) {
      throw new Error('No response from AI');
    }

    logger.info('AI response received', { contentLength: aiContent.length });

    let jsonStr = aiContent;
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const firstBrace = aiContent.indexOf('{');
      const lastBrace = aiContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = aiContent.substring(firstBrace, lastBrace + 1);
      }
    }

    jsonStr = repairJsonStringForParsing(jsonStr);

    let optimization: Record<string, unknown>;
    try {
      optimization = JSON.parse(jsonStr);
    } catch (parseErr) {
      logger.error('JSON parse error', { error: parseErr instanceof Error ? parseErr.message : 'Unknown', snippet: jsonStr.substring(0, 500) });
      throw new Error('Failed to parse AI response as JSON');
    }

    const requiredFields = ['optimizedTitle', 'metaDescription', 'h1', 'h2s', 'optimizedContent', 'contentStrategy', 'qualityScore'];
    for (const field of requiredFields) {
      if (!(optimization as Record<string, unknown>)[field]) {
        throw new Error(`AI response missing required field: ${field}`);
      }
    }

    await updateJobProgress(supabase, jobId, 'validating_content', 90, logger);

    optimization.optimizedContent = convertMarkdownToHtml(optimization.optimizedContent as string);
    optimization.optimizedContent = validateInternalLinks(optimization.optimizedContent as string, validUrlSet, logger);

    const contentLength = (optimization.optimizedContent as string)?.length || 0;
    const wordCount = (optimization.optimizedContent as string)?.split(/\s+/).length || 0;

    logger.info('Content validated', {
      contentLength,
      wordCount,
      qualityScore: optimization.qualityScore,
    });

    // Warn if word count is too low
    if (wordCount < effectiveAdvanced.minWordCount * 0.8) {
      logger.warn('Word count below target', { expected: effectiveAdvanced.minWordCount, actual: wordCount });
    }

    await supabase.from('jobs').update({
      status: 'completed',
      current_step: 'optimization_complete',
      progress: 100,
      completed_at: new Date().toISOString(),
      result: optimization,
      ai_tokens_used: aiData.usage?.total_tokens || 0,
    }).eq('id', jobId);

    const scoreAfter = {
      overall: optimization.qualityScore || 75,
      seo: optimization.seoScore || 80,
      readability: optimization.readabilityScore || 70,
      engagement: optimization.engagementScore || 75,
      title: optimization.optimizedTitle ? 90 : 50,
      meta: optimization.metaDescription ? 90 : 50,
      headings: (optimization.h2s as string[])?.length > 0 ? 85 : 50,
      content: (optimization.contentStrategy as Record<string, unknown>)?.readabilityScore || 60,
    };

    await supabase.from('pages').update({
      status: 'completed',
      score_after: scoreAfter,
      word_count: wordCount,
      updated_at: new Date().toISOString(),
    }).eq('id', pageId);

    await supabase.from('activity_log').insert({
      page_id: pageId,
      job_id: jobId,
      type: 'success',
      message: `Optimized: ${wordCount} words, score ${optimization.qualityScore}`,
      details: {
        qualityScore: optimization.qualityScore,
        seoScore: optimization.seoScore,
        wordCount,
        requestId: logger.getRequestId(),
      },
    });

    logger.info('Optimization complete', { qualityScore: optimization.qualityScore, wordCount });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
  }
}

// ============================================================
// MAIN SERVER
// ============================================================
serve(async (req) => {
  const logger = new Logger('optimize-content');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: OptimizeRequest = await req.json();
    const { pageId, siteUrl, username, applicationPassword } = body;

    validateRequired(body as unknown as Record<string, unknown>, ['pageId', 'siteUrl', 'username', 'applicationPassword']);

    logger.info('Received optimization request', { pageId, siteUrl });

    const rateLimitKey = `optimize:${siteUrl}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000);
    if (!rateLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.retryAfterMs || 0) / 1000)} seconds.`,
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    const useUserAI = body.aiConfig?.provider && body.aiConfig?.apiKey && body.aiConfig?.model;
    if (!useUserAI && !lovableApiKey) {
      throw new AppError('No AI provider configured.', 'AI_NOT_CONFIGURED', 500);
    }

    await supabase.from('pages').update({ status: 'optimizing' }).eq('id', pageId);

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        page_id: pageId,
        status: 'running',
        current_step: 'queued',
        progress: 5,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new AppError('Failed to create job', 'JOB_CREATE_FAILED', 500);
    }

    const jobId = job.id;
    logger.info('Job created', { jobId });

    // @ts-ignore
    EdgeRuntime.waitUntil(
      processOptimizationJob(
        supabase,
        supabaseUrl,
        supabaseKey,
        lovableApiKey,
        jobId,
        pageId,
        body,
        logger
      )
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Optimization started',
        jobId,
        requestId: logger.getRequestId(),
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Request failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return createErrorResponse(error as Error, logger.getRequestId());
  }
});
