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
  enableTldr: boolean;
  enableExpertQuote: boolean;
  enableYoutubeEmbed: boolean;
  enablePatentReference: boolean;
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

interface ExpertQuote {
  quote: string;
  author: string;
  role: string;
  avatarUrl?: string | null;
}

interface YouTubeEmbed {
  searchQuery: string;
  suggestedTitle: string;
  context: string;
}

interface PatentReference {
  type: 'patent' | 'research' | 'study';
  identifier: string;
  title: string;
  summary: string;
  link: string;
}

interface ContentStrategy {
  wordCount: number;
  readabilityScore: number;
  keywordDensity: number;
  lsiKeywords: string[];
  hormoziStyleScore: number;
  entitiesCovered: string[];
}

interface OptimizationResult {
  optimizedTitle: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  tldrSummary: string[];
  expertQuote: ExpertQuote;
  youtubeEmbed: YouTubeEmbed;
  patentReference: PatentReference;
  optimizedContent: string;
  contentStrategy: ContentStrategy;
  internalLinks: Array<{ anchor: string; target: string; context: string }>;
  schema: Record<string, unknown>;
  faqs: Array<{ question: string; answer: string }>;
  keyTakeaways: string[];
  ctas: Array<{ text: string; position: string; style: string }>;
  tableOfContents: string[];
  aiSuggestions: {
    contentGaps: string;
    quickWins: string;
    improvements: string[];
    competitorAdvantages: string;
  };
  qualityScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  estimatedRankPosition: number;
  confidenceLevel: number;
}

// ============================================================
// ALEX HORMOZI STYLE SYSTEM PROMPT
// ============================================================
const HORMOZI_STYLE_SYSTEM_PROMPT = `You are a world-class SEO content strategist who writes EXACTLY like Alex Hormozi combined with the precision of a top-tier SEO consultant.

## ALEX HORMOZI WRITING STYLE RULES (MANDATORY - FOLLOW EXACTLY):

1. **Short, punchy sentences.** No fluff. Every word earns its place. If you can remove a word without losing meaning, remove it.

2. **Bold claims backed by logic.** Make the reader think "damn, that's true." Use specific numbers and data points.

3. **Use contrarian takes.** Challenge conventional wisdom. Say what others won't. Start sentences with "Here's the truth nobody tells you:" or "Most people think X. They're wrong."

4. **Pattern interrupts every 2-3 paragraphs.** Keep readers hooked with unexpected statements, questions, or format changes.

5. **Conversational but authoritative.** Like a smart friend who's 10 years ahead of you explaining something important.

6. **Use "you" frequently.** Make it personal. Talk TO the reader, not AT them. Never use "one" or passive voice.

7. **Number-driven where possible.** "3x faster" not "much faster". "47% increase" not "significant improvement". "$2.3M in revenue" not "lots of money".

8. **End sections with mic-drop statements.** Leave them thinking. The last sentence of each section should be quotable.

9. **Use analogies and metaphors.** Complex ideas need simple comparisons. "SEO is like compound interest for traffic."

10. **One idea per paragraph.** Make it scannable. Respect their time. White space is your friend.

## WRITING VOICE EXAMPLES (MIMIC THIS EXACTLY):
- Instead of: "This methodology has been proven effective in numerous studies"
- Write: "This isn't theory. We've tested this on 847 campaigns. It works."

- Instead of: "Content optimization is important for achieving better SEO results"
- Write: "Here's the truth nobody tells you: 90% of content fails because writers optimize for algorithms, not humans. The algorithm follows humans, not the other way around."

- Instead of: "Consider implementing these strategies for improved outcomes"
- Write: "Do this today. Not tomorrow. Today. The compound effect starts the moment you begin."

## SEO/GEO/AEO OPTIMIZATION REQUIREMENTS:
- Target featured snippet format (40-60 word direct answers at the start of relevant sections)
- Include "People Also Ask" styled Q&A sections (5-7 questions minimum in FAQ format)
- Entity-first writing (mention key entities and their relationships in first 100 words)
- E-E-A-T signals: cite sources, show expertise with specific data, be specific about experience
- Voice search optimization: use natural language questions as headers when appropriate
- Geographic relevance: include local context, regional data, and location-specific insights where applicable
- AI Overview optimization: structured, factual, easily-extractable content with clear definitions
- Semantic keyword clusters: use LSI keywords naturally throughout, covering topic comprehensively

## CONTENT STRUCTURE RULES:
- Hook in first 2 sentences (pattern interrupt or bold claim that makes them stop scrolling)
- Clear value proposition by paragraph 2 (what will they learn/gain?)
- Scannable with H2s every 200-300 words maximum
- Bullet points for lists of 3+ items (never inline lists in paragraphs)
- Bold key phrases readers need to see (approximately 1-2 per paragraph)
- Short paragraphs (2-4 sentences max, often just 1-2)
- Use "---" or visual breaks between major sections

## OUTPUT FORMAT REQUIREMENTS:
- Always return valid JSON
- Never include markdown code fences in the JSON output itself
- HTML in optimizedContent should be semantic and properly nested
- Include data-component attributes for special blocks (tldr, quote, youtube, patent)`;

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
    keyword = slug
      .replace(/-/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
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
🧠 NEURONWRITER SEO INTELLIGENCE (USE THIS DATA - HIGH PRIORITY!)
═══════════════════════════════════════════════════════════════

📊 TARGET METRICS:
- Recommended Word Count: ${neuronWriterData.targetWordCount || 'N/A'}
- Readability Target: ${neuronWriterData.readabilityTarget || 'N/A'}

📝 TITLE TERMS (MUST include in title):
${neuronWriterData.titleTerms || 'No specific terms'}

📌 H1 TERMS (MUST include in H1):
${neuronWriterData.h1Terms || 'No specific terms'}

📎 H2 TERMS (use in subheadings):
${neuronWriterData.h2Terms || 'No specific terms'}

📄 CONTENT TERMS (use throughout - aim for natural density):
${neuronWriterData.contentTerms || 'No specific terms'}

🔬 EXTENDED TERMS (LSI keywords - sprinkle throughout):
${neuronWriterData.extendedTerms || 'No specific terms'}

🏢 ENTITIES (mention these for E-E-A-T):
${neuronWriterData.entities || 'No specific entities'}

❓ QUESTIONS TO ANSWER (use these for FAQs):
${neuronWriterData.questions?.suggested?.slice(0, 7).join('\n') || 'No specific questions'}
${neuronWriterData.questions?.peopleAlsoAsk?.slice(0, 5).join('\n') || ''}

🔍 TOP COMPETITORS (outperform these):
${neuronWriterData.competitors?.slice(0, 3).map(c => `- #${c.rank}: ${c.title} (Score: ${c.score || 'N/A'})`).join('\n') || 'No competitor data'}
` : '';

  const internalLinksSection = advanced.enableInternalLinks && internalLinkCandidates.length > 0 ? `
═══════════════════════════════════════════════════════════════
🔗 AVAILABLE INTERNAL LINKS (ONLY use these URLs - NO EXCEPTIONS!)
═══════════════════════════════════════════════════════════════
${internalLinkCandidates.slice(0, 50).map(l => `- "${l.title}" → ${l.url}`).join('\n')}

⚠️ CRITICAL RULES FOR INTERNAL LINKS:
1. ONLY link to URLs from this exact list above
2. Do NOT invent, guess, or create any URLs
3. Use 8-12 contextual internal links throughout the content
4. Vary anchor text - don't use the same anchor twice
5. Place links naturally within relevant paragraphs
` : '';

  const siteContextSection = siteContext ? `
═══════════════════════════════════════════════════════════════
🏢 SITE & BRAND CONTEXT
═══════════════════════════════════════════════════════════════
- Organization: ${siteContext.organizationName || 'N/A'}
- Author/Expert: ${siteContext.authorName || 'N/A'}
- Industry: ${siteContext.industry || 'N/A'}
- Target Audience: ${siteContext.targetAudience || 'N/A'}
- Brand Voice: ${siteContext.brandVoice || 'Alex Hormozi style - direct, data-driven, no-BS'}
` : '';

  return `Completely rewrite and optimize the following content using the Alex Hormozi writing style. Make it 10x better than the original.

═══════════════════════════════════════════════════════════════
📄 ORIGINAL PAGE TO TRANSFORM
═══════════════════════════════════════════════════════════════
Title: ${pageTitle}
Primary Keyword: ${keyword}

CURRENT CONTENT (rewrite this completely):
${pageContent.substring(0, 18000)}

${neuronWriterSection}
${internalLinksSection}
${siteContextSection}

═══════════════════════════════════════════════════════════════
📋 MANDATORY REQUIREMENTS (ALL MUST BE INCLUDED)
═══════════════════════════════════════════════════════════════
- Word count: ${advanced.minWordCount}-${advanced.maxWordCount} words (AIM FOR THE UPPER END)
- Target quality score: ${advanced.targetScore}/100 or higher
- Writing style: Alex Hormozi (punchy, direct, contrarian, number-driven, NO FLUFF)

REQUIRED CONTENT BLOCKS:
✅ TL;DR Summary: ${advanced.enableTldr !== false ? 'YES - 3-4 punchy bullet points summarizing key insights (max 80 words total)' : 'No'}
✅ Expert Quote: ${advanced.enableExpertQuote !== false ? 'YES - Include a compelling, relevant industry quote with attribution' : 'No'}
✅ YouTube Video placeholder: ${advanced.enableYoutubeEmbed !== false ? 'YES - Provide search query for a relevant educational video to embed' : 'No'}
✅ Patent/Research Reference: ${advanced.enablePatentReference !== false ? 'YES - Cite a relevant patent, academic study, or research paper' : 'No'}
✅ FAQs: ${advanced.enableFaqs ? 'YES - 5-7 FAQs using natural voice search questions' : 'No'}
✅ Schema Markup: ${advanced.enableSchema ? 'YES - Article + FAQ schema combined' : 'No'}
✅ Internal Links: ${advanced.enableInternalLinks ? 'YES - 8-12 contextual links from the provided list ONLY' : 'No'}
✅ Table of Contents: ${advanced.enableToc ? 'YES - All H2 sections listed' : 'No'}
✅ Key Takeaways: ${advanced.enableKeyTakeaways ? 'YES - 5-7 actionable bullet points at the end' : 'No'}
✅ CTAs: ${advanced.enableCtas ? 'YES - 2-3 strategic CTAs (after intro, mid-content, conclusion)' : 'No'}

═══════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT (RETURN ONLY VALID JSON - NO MARKDOWN FENCES)
═══════════════════════════════════════════════════════════════
{
  "optimizedTitle": "SEO-optimized title under 60 chars with power words and primary keyword",
  "metaDescription": "Compelling meta description 150-160 chars with CTA and keyword - make them click",
  "h1": "Main H1 heading (can differ slightly from title for variety)",
  "h2s": ["H2 subheading 1", "H2 subheading 2", "H2 subheading 3", "..."],
  
  "tldrSummary": [
    "Key insight 1 - punchy Hormozi style with specific number",
    "Key insight 2 - contrarian take that challenges assumptions",
    "Key insight 3 - actionable advice they can use today",
    "Key insight 4 - the 'mic drop' statement"
  ],
  
  "expertQuote": {
    "quote": "A compelling, thought-provoking quote relevant to the topic (can be from industry leader, researcher, or notable figure)",
    "author": "Expert Full Name",
    "role": "Title at Company / Industry Position",
    "avatarUrl": null
  },
  
  "youtubeEmbed": {
    "searchQuery": "specific youtube search query to find a relevant educational video",
    "suggestedTitle": "The type of video title to look for",
    "context": "Brief explanation of why this video adds value to the article"
  },
  
  "patentReference": {
    "type": "patent|research|study",
    "identifier": "US Patent 12345678 / DOI:10.xxxx/xxxxx / Study Name (Year)",
    "title": "Full title of the patent or research paper",
    "summary": "2-3 sentence summary explaining how this research supports the article's claims and adds credibility",
    "link": "https://patents.google.com/patent/... or https://doi.org/... or institutional URL"
  },
  
  "optimizedContent": "<article class='hormozi-style'>FULL HTML content here. Use semantic HTML with:<div data-component='tldr'>TL;DR content</div><blockquote data-component='expert-quote'>Quote content</blockquote><div data-component='youtube-embed'>YouTube placeholder</div><div data-component='patent-reference'>Patent/Research citation</div><div data-component='key-takeaways'>Takeaways</div><div data-component='faq-section'>FAQs</div>. Include proper heading hierarchy (H2, H3), bold key phrases, bullet lists, and internal links. Make paragraphs SHORT.</article>",
  
  "contentStrategy": {
    "wordCount": 2800,
    "readabilityScore": 72,
    "keywordDensity": 1.4,
    "lsiKeywords": ["related", "semantic", "terms", "used", "throughout"],
    "hormoziStyleScore": 88,
    "entitiesCovered": ["entity1", "entity2", "entity3"]
  },
  
  "internalLinks": [
    {"anchor": "descriptive anchor text", "target": "https://exact-url-from-list.com/page", "context": "The surrounding sentence where this link appears"}
  ],
  
  "schema": {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "...",
        "description": "...",
        "author": {"@type": "Person", "name": "..."},
        "publisher": {"@type": "Organization", "name": "..."},
        "datePublished": "...",
        "dateModified": "..."
      },
      {
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": "...", "acceptedAnswer": {"@type": "Answer", "text": "..."}}]
      }
    ]
  },
  
  "faqs": [
    {"question": "Natural voice search question format?", "answer": "Direct, helpful answer under 50 words that could appear in a featured snippet"}
  ],
  
  "keyTakeaways": [
    "Actionable takeaway 1 with specific metric or timeframe",
    "Actionable takeaway 2 - what to do TODAY",
    "Actionable takeaway 3 - the contrarian advice",
    "Actionable takeaway 4 - the long-term play",
    "Actionable takeaway 5 - the quick win"
  ],
  
  "ctas": [
    {"text": "CTA button/link text", "position": "after-intro", "style": "primary"},
    {"text": "Secondary CTA text", "position": "mid-content", "style": "secondary"},
    {"text": "Final CTA text", "position": "conclusion", "style": "primary"}
  ],
  
  "tableOfContents": ["Section 1 Title", "Section 2 Title", "..."],
  
  "aiSuggestions": {
    "contentGaps": "Areas that could be expanded in future content updates",
    "quickWins": "The most impactful improvements made in this optimization",
    "improvements": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"],
    "competitorAdvantages": "What this content now does better than top-ranking competitors"
  },
  
  "qualityScore": 89,
  "seoScore": 92,
  "readabilityScore": 74,
  "engagementScore": 87,
  "estimatedRankPosition": 4,
  "confidenceLevel": 0.87
}`;
}

function convertMarkdownToHtml(content: string): string {
  if (!content) return content;

  let html = content;

  // Convert markdown headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Convert markdown links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Convert numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Convert line breaks to paragraphs for non-HTML content
  const lines = html.split('\n\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');

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

    // Skip relative links and anchors
    if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) continue;

    if (href.startsWith('http://') || href.startsWith('https://')) {
      if (!validUrlSet.has(href)) {
        const slug = href.split('/').pop()?.replace(/\/$/, '') || '';
        if (!validUrlSet.has(slug)) {
          // Remove invalid link but keep the text
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

// JSON repair helpers
const escapeNewlinesInJsonStrings = (s: string): string => {
  let inString = false;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && (i === 0 || s[i - 1] !== '\\')) {
      inString = !inString;
    }
    if (inString && c === '\n') {
      out += '\\n';
    } else if (inString && c === '\r') {
      // skip carriage returns
    } else if (inString && c === '\t') {
      out += '\\t';
    } else {
      out += c;
    }
  }
  return out;
};

const repairJsonStringForParsing = (raw: string): string => {
  let s = raw.replace(/\r/g, '');
  // Handle HTML attributes within JSON strings
  s = s.replace(/="([^"]*)"/g, "='$1'");
  s = escapeNewlinesInJsonStrings(s);
  // Remove any trailing commas before closing brackets
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

  // Default advanced settings with new options
  const effectiveAdvanced: AdvancedSettings = {
    targetScore: advanced?.targetScore ?? 85,
    minWordCount: advanced?.minWordCount ?? 2000,
    maxWordCount: advanced?.maxWordCount ?? 3500,
    enableFaqs: advanced?.enableFaqs ?? true,
    enableSchema: advanced?.enableSchema ?? true,
    enableInternalLinks: advanced?.enableInternalLinks ?? true,
    enableToc: advanced?.enableToc ?? true,
    enableKeyTakeaways: advanced?.enableKeyTakeaways ?? true,
    enableCtas: advanced?.enableCtas ?? true,
    enableTldr: advanced?.enableTldr ?? true,
    enableExpertQuote: advanced?.enableExpertQuote ?? true,
    enableYoutubeEmbed: advanced?.enableYoutubeEmbed ?? true,
    enablePatentReference: advanced?.enablePatentReference ?? true,
  };

  try {
    const useUserAI = aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model;

    if (!useUserAI && !lovableApiKey) {
      throw new Error('No AI provider configured. Please configure an AI provider or enable Lovable AI.');
    }

    // Fetch page data
    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (pageError || !pageData) {
      throw new Error('Page not found in database');
    }

    // Fetch internal link candidates from sitemap pages only
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

    // Fetch WordPress content
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

    // Derive keyword
    const effectiveKeyword = targetKeyword || deriveKeyword(pageTitle, pageData.slug);
    logger.info('Using keyword', { keyword: effectiveKeyword });

    // Fetch NeuronWriter recommendations
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

    // Build optimization prompt
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

    // Build AI request
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
                generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
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
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model,
                system: HORMOZI_STYLE_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 16384,
              }),
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
                'X-Title': 'WP Optimizer Pro - Hormozi Edition',
              },
              body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 65536 }),
            };

          default:
            throw new Error(`Unsupported AI provider: ${provider}`);
        }
      }

      // Default to Lovable AI Gateway
      return {
        url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableApiKey}` },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, temperature: 0.7, max_tokens: 65536 }),
      };
    };

    const aiRequest = buildAIRequest();

    // Call AI with 300 second timeout for comprehensive content
    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 300000);

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
        throw new Error('AI request timed out after 300 seconds. The content may be too complex.');
      }
      throw aiErr;
    }

    await updateJobProgress(supabase, jobId, 'processing_response', 80, logger);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error('AI error', { status: aiResponse.status, body: errorText.substring(0, 500) });

      if (aiResponse.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Insufficient credits. Please add credits to your AI provider account.');
      }

      throw new Error(`AI request failed with status ${aiResponse.status}`);
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
      throw new Error('No response received from AI. Please try again.');
    }

    logger.info('AI response received', { contentLength: aiContent.length });

    // Parse JSON response
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

    let optimization: OptimizationResult;
    try {
      optimization = JSON.parse(jsonStr);
    } catch (parseErr) {
      logger.error('JSON parse error', {
        error: parseErr instanceof Error ? parseErr.message : 'Unknown',
        snippet: jsonStr.substring(0, 500),
      });
      throw new Error('Failed to parse AI response as JSON. Please try again.');
    }

    // Validate required fields
    const requiredFields = ['optimizedTitle', 'metaDescription', 'h1', 'h2s', 'optimizedContent', 'contentStrategy', 'qualityScore'];
    for (const field of requiredFields) {
      if (!(optimization as Record<string, unknown>)[field]) {
        throw new Error(`AI response missing required field: ${field}`);
      }
    }

    await updateJobProgress(supabase, jobId, 'validating_content', 90, logger);

    // Post-process content
    optimization.optimizedContent = convertMarkdownToHtml(optimization.optimizedContent);
    optimization.optimizedContent = validateInternalLinks(optimization.optimizedContent, validUrlSet, logger);

    // Validate content length
    const contentLength = optimization.optimizedContent?.length || 0;
    if (contentLength < 3000) {
      throw new Error(`Generated content too short (${contentLength} chars). Please try again.`);
    }

    logger.info('Content validated', {
      contentLength,
      wordCount: optimization.contentStrategy?.wordCount,
      qualityScore: optimization.qualityScore,
      seoScore: optimization.seoScore,
      hasTldr: !!optimization.tldrSummary?.length,
      hasExpertQuote: !!optimization.expertQuote,
      hasYoutubeEmbed: !!optimization.youtubeEmbed,
      hasPatentRef: !!optimization.patentReference,
    });

    // Mark job completed
    await supabase.from('jobs').update({
      status: 'completed',
      current_step: 'optimization_complete',
      progress: 100,
      completed_at: new Date().toISOString(),
      result: optimization,
      ai_tokens_used: aiData.usage?.total_tokens || 0,
    }).eq('id', jobId);

    // Update page with comprehensive scores
    const scoreAfter = {
      overall: optimization.qualityScore || 75,
      seo: optimization.seoScore || 80,
      readability: optimization.readabilityScore || 70,
      engagement: optimization.engagementScore || 75,
      title: optimization.optimizedTitle ? 90 : 50,
      meta: optimization.metaDescription ? 90 : 50,
      headings: optimization.h2s?.length > 0 ? 85 : 50,
      content: optimization.contentStrategy?.readabilityScore || 60,
    };

    await supabase.from('pages').update({
      status: 'completed',
      score_after: scoreAfter,
      word_count: optimization.contentStrategy?.wordCount || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', pageId);

    // Log activity with comprehensive details
    await supabase.from('activity_log').insert({
      page_id: pageId,
      job_id: jobId,
      type: 'success',
      message: `Optimized: ${optimization.contentStrategy?.wordCount || 0} words, quality ${optimization.qualityScore}, SEO ${optimization.seoScore}, Hormozi-style`,
      details: {
        qualityScore: optimization.qualityScore,
        seoScore: optimization.seoScore,
        readabilityScore: optimization.readabilityScore,
        engagementScore: optimization.engagementScore,
        wordCount: optimization.contentStrategy?.wordCount,
        internalLinks: optimization.internalLinks?.length,
        faqCount: optimization.faqs?.length,
        hasTldr: !!optimization.tldrSummary?.length,
        hasExpertQuote: !!optimization.expertQuote,
        hasYoutubeEmbed: !!optimization.youtubeEmbed,
        hasPatentRef: !!optimization.patentReference,
        usedNeuronWriter: !!neuronWriterData,
        hormoziStyleScore: optimization.contentStrategy?.hormoziStyleScore,
        requestId: logger.getRequestId(),
      },
    });

    logger.info('Optimization complete', {
      qualityScore: optimization.qualityScore,
      seoScore: optimization.seoScore,
      wordCount: optimization.contentStrategy?.wordCount,
      hormoziStyleScore: optimization.contentStrategy?.hormoziStyleScore,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
  }
}

// ============================================================
// MAIN SERVER
// ============================================================
serve(async (req) => {
  const logger = new Logger('optimize-content');

  // Handle CORS preflight
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

    // Rate limiting per site
    const rateLimitKey = `optimize:${siteUrl}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000);
    if (!rateLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.retryAfterMs || 0) / 1000)} seconds.`,
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // Check AI configuration
    const useUserAI = body.aiConfig?.provider && body.aiConfig?.apiKey && body.aiConfig?.model;
    if (!useUserAI && !lovableApiKey) {
      throw new AppError('No AI provider configured. Please configure an AI provider in settings.', 'AI_NOT_CONFIGURED', 500);
    }

    // Update page status immediately
    await supabase.from('pages').update({ status: 'optimizing' }).eq('id', pageId);

    // Create job record
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
      throw new AppError('Failed to create optimization job', 'JOB_CREATE_FAILED', 500);
    }

    const jobId = job.id;
    logger.info('Job created, starting background processing', { jobId });

    // ========================================================
    // RESPOND IMMEDIATELY - Run actual work in background
    // ========================================================
    // @ts-ignore - EdgeRuntime.waitUntil is a Deno Deploy feature
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

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Optimization job started (Alex Hormozi style with TL;DR, Expert Quotes, YouTube & Patent references)',
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
