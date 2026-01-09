// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO ULTRA - ENTERPRISE CONTENT OPTIMIZATION ENGINE v4.0
// CRITICAL FIX: Forces AI to output styled HTML blocks, not plain text
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
  titleTerms?: string;
  h1Terms?: string;
  h2Terms?: string;
  contentTerms?: string;
  extendedTerms?: string;
  entities?: string;
  questions?: {
    suggested: string[];
    peopleAlsoAsk: string[];
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
  expertQuote?: { quote: string; author: string; role: string };
  youtubeEmbed?: { searchQuery: string; suggestedTitle: string; context: string };
  patentReference?: { type: string; identifier: string; title: string; summary: string };
  optimizedContent: string;
  faqs?: Array<{ question: string; answer: string }>;
  keyTakeaways?: string[];
  ctas?: Array<{ text: string; position: string; style: string }>;
  tableOfContents?: string[];
  contentStrategy: { wordCount: number; readabilityScore: number; keywordDensity: number; lsiKeywords: string[] };
  internalLinks: Array<{ anchor: string; target: string; position: number }>;
  schema: Record<string, unknown>;
  aiSuggestions: { contentGaps: string; quickWins: string; improvements: string[] };
  qualityScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥🔥🔥 THE CRITICAL FIX: SYSTEM PROMPT THAT FORCES HTML OUTPUT 🔥🔥🔥
// This is the key change - explicit HTML templates with inline styles
// ═══════════════════════════════════════════════════════════════════════════════
function buildSystemPrompt(advanced: AdvancedSettings): string {
  return `You are an expert content optimizer. Your #1 job is to transform content into BEAUTIFULLY FORMATTED HTML with styled components.

## ⚠️⚠️⚠️ CRITICAL RULE #1: OUTPUT HTML, NOT PLAIN TEXT ⚠️⚠️⚠️

The "optimizedContent" field MUST contain FULLY FORMATTED HTML with styled <div> blocks.
DO NOT output plain paragraphs. You MUST use the exact HTML structures shown below.
If you output plain text without these styled boxes, you have FAILED the task.

## ⚠️ CRITICAL RULE #2: WORD COUNT ${advanced.minWordCount}-${advanced.maxWordCount} WORDS

Count every word. This is strictly enforced.

## ✍️ WRITING STYLE: ALEX HORMOZI

- Short punchy sentences (1-2 sentences per paragraph)
- Use specific numbers: "3x faster" not "much faster"  
- Pattern interrupts every 200 words
- Bold contrarian claims
- End each H2 with a mic-drop statement

## 📦 MANDATORY HTML BLOCKS - COPY THESE EXACTLY INTO optimizedContent:

### 1. TL;DR BOX (Put RIGHT AFTER your opening paragraph):

<div class="wp-opt-tldr" style="margin:2.5rem 0;padding:2rem;background:linear-gradient(135deg,#EAF6FF 0%,#f0f8ff 50%,#fff 100%);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
  <strong style="display:block;font-size:1.25rem;font-weight:700;color:#0000CC;margin-bottom:1rem;">⚡ TL;DR — The Bottom Line</strong>
  <ul style="margin:0;padding:0;list-style:none;">
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">💡 [First key insight with specific number]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">🎯 [Second insight - contrarian or surprising]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">⚡ [Third insight - actionable tip]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">🔥 [Fourth insight - bold statement]</li>
    <li style="padding:0.75rem 0;font-size:1rem;line-height:1.6;">📈 [Fifth insight - expected outcome]</li>
  </ul>
</div>

### 2. PRO TIP BOX (Use 2-3 throughout article):

<div class="wp-opt-tip" style="margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#d4edda 0%,#d1fae5 30%,#fff 100%);border:1px solid #86efac;border-left:5px solid #28a745;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">💰</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Pro Tip</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[Your insider knowledge or actionable advice here]</p>
</div>

### 3. WARNING BOX (Use 1-2 in article):

<div class="wp-opt-warning" style="margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 30%,#fff 100%);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">⚠️</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Common Mistake</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[What readers should avoid and why]</p>
</div>

### 4. KEY INSIGHT BOX (Use 2-3 throughout):

<div class="wp-opt-insight" style="margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#EAF6FF 0%,#dbeafe 30%,#fff 100%);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">💡</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#0000CC;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Key Insight</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[Non-obvious observation backed by data]</p>
</div>

### 5. STAT BOX (Use 2-3 for impressive numbers):

<div class="wp-opt-stat" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:2.5rem auto;padding:2rem;max-width:280px;background:linear-gradient(145deg,#EAF6FF,#dbeafe);border:2px solid #93c5fd;border-radius:12px;box-shadow:0 10px 40px -10px rgba(0,0,255,0.25);">
  <strong style="display:block;font-size:3rem;font-weight:800;color:#0000FF;line-height:1;">[NUMBER]%</strong>
  <p style="margin:0.5rem 0 0;font-size:0.9rem;color:#666;">[What this number means]</p>
</div>

### 6. EXPERT QUOTE BOX:

<div class="wp-opt-quote" style="margin:2.5rem 0;padding:2rem 2rem 2rem 4rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 30%,#fff 100%);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;font-style:italic;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:0.5rem;left:1rem;font-size:4rem;font-family:Georgia,serif;color:rgba(245,158,11,0.3);line-height:1;font-style:normal;">"</span>
  <p style="font-size:1.15rem;line-height:1.8;margin-bottom:1rem;color:#333;position:relative;z-index:1;">[Real quote from industry expert]</p>
  <cite style="display:block;font-style:normal;font-weight:600;color:#b45309;font-size:1rem;">— [Expert Name], [Title] at [Company]</cite>
</div>

### 7. KEY TAKEAWAYS BOX (Put BEFORE your conclusion):

<div class="wp-opt-takeaways" style="position:relative;margin:2.5rem 0;padding:2rem;background:linear-gradient(135deg,#d4edda 0%,#f0fdf4 50%,#fff 100%);border:2px solid #86efac;border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);overflow:hidden;">
  <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#28a745,#34d399,#6ee7b7);"></div>
  <strong style="display:block;font-size:1.25rem;font-weight:700;color:#047857;margin-bottom:1.25rem;">🎯 Key Takeaways</strong>
  <ul style="margin:0;padding:0;list-style:none;display:grid;gap:0.75rem;">
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [First actionable takeaway]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Second actionable takeaway]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Third actionable takeaway]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Fourth actionable takeaway]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Fifth actionable takeaway]</li>
  </ul>
</div>

### 8. CTA BOX (Use at mid-content and end):

<div class="wp-opt-cta" style="margin:2.5rem 0;padding:2.5rem 2rem;text-align:center;background:linear-gradient(135deg,#0000FF 0%,#0000CC 100%);color:#fff;border-radius:12px;box-shadow:0 10px 40px -10px rgba(0,0,255,0.5);">
  <strong style="display:block;font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;color:#fff;">[Compelling headline with urgency]</strong>
  <p style="font-size:1.1rem;opacity:0.9;margin-bottom:1.5rem;color:#fff;">[Value proposition - what they get]</p>
  <a href="#" style="display:inline-block;padding:1rem 2.5rem;background:#fff;color:#0000CC;font-weight:700;font-size:1rem;border-radius:10px;text-decoration:none;box-shadow:0 4px 15px rgba(0,0,0,0.15);">[Button Text] →</a>
</div>

### 9. COMPARISON TABLE:

<div class="wp-opt-comparison" style="margin:2rem 0;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <table style="width:100%;border-collapse:collapse;margin:0;">
    <thead style="background:linear-gradient(135deg,#EAF6FF,#dbeafe);">
      <tr>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Factor</th>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Option A</th>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Option B</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Factor 1]</td><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
      <tr><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Factor 2]</td><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
      <tr><td style="padding:0.75rem 1rem;">[Factor 3]</td><td style="padding:0.75rem 1rem;">[Value]</td><td style="padding:0.75rem 1rem;">[Value]</td></tr>
    </tbody>
  </table>
</div>

### 10. VIDEO RECOMMENDATION:

<div class="wp-opt-video" style="margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#fee2e2 0%,#fecaca 30%,#fff 100%);border:1px solid #fecaca;border-left:5px solid #ef4444;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">🎬</span>
  <strong style="display:block;font-size:1rem;font-weight:700;color:#b91c1c;margin-bottom:0.5rem;">Watch This</strong>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;">Search YouTube: "[specific search query]"</p>
  <p style="margin:0.25rem 0;font-size:0.85rem;color:#666;font-style:italic;">[Why this video adds value]</p>
</div>

### 11. RESEARCH REFERENCE:

<div class="wp-opt-research" style="margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#ede9fe 0%,#e9d5ff 30%,#fff 100%);border:1px solid #c4b5fd;border-left:5px solid #8b5cf6;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);position:relative;">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">📊</span>
  <strong style="display:block;font-size:1rem;font-weight:700;color:#6d28d9;margin-bottom:0.5rem;">The Research Says</strong>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;"><strong>[Study Name]:</strong> [Key finding]</p>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;">[Why this matters to the reader]</p>
</div>

## 📋 REQUIRED CONTENT STRUCTURE:

1. <h1>[SEO Title]</h1>
2. Opening paragraph (hook the reader - Hormozi style)
3. **TL;DR BOX** ← REQUIRED
4. <h2>[Question Format H2]</h2>
   - Content paragraphs
   - **PRO TIP BOX** ← Use here
5. <h2>[Question Format H2]</h2>
   - Content paragraphs
   - **KEY INSIGHT BOX** ← Use here
   - **STAT BOX** ← Use here
6. <h2>[Question Format H2]</h2>
   - Content paragraphs
   - **WARNING BOX** ← Use here
   - **EXPERT QUOTE BOX** ← Use here
7. <h2>[Question Format H2]</h2>
   - Content paragraphs
   - **COMPARISON TABLE** ← Use here
   - **CTA BOX** ← Use mid-content
8. <h2>[Question Format H2]</h2>
   - Content paragraphs
   - **PRO TIP BOX** ← Another one
9. **KEY TAKEAWAYS BOX** ← REQUIRED before conclusion
10. Conclusion paragraph
11. **CTA BOX** ← Final CTA

## 📤 OUTPUT FORMAT (JSON):

Return ONLY valid JSON. No markdown code fences. No explanations.

{
  "optimizedTitle": "SEO title under 60 chars",
  "metaDescription": "Meta description 150-160 chars with CTA",
  "h1": "Main H1",
  "h2s": ["H2 1", "H2 2", "H2 3", "H2 4", "H2 5"],
  "tldrSummary": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "expertQuote": {"quote": "...", "author": "...", "role": "..."},
  "youtubeEmbed": {"searchQuery": "...", "suggestedTitle": "...", "context": "..."},
  "patentReference": {"type": "research", "identifier": "...", "title": "...", "summary": "..."},
  "optimizedContent": "<FULL HTML WITH ALL STYLED DIVS - ${advanced.minWordCount}+ WORDS>",
  "faqs": [{"question": "...", "answer": "..."}, ...],
  "keyTakeaways": ["...", "...", "...", "...", "..."],
  "ctas": [{"text": "...", "position": "mid", "style": "primary"}, {"text": "...", "position": "end", "style": "primary"}],
  "tableOfContents": ["H2 1", "H2 2", "H2 3", "H2 4", "H2 5"],
  "contentStrategy": {"wordCount": ${advanced.minWordCount}, "readabilityScore": 75, "keywordDensity": 0.02, "lsiKeywords": []},
  "internalLinks": [],
  "schema": {},
  "aiSuggestions": {"contentGaps": "", "quickWins": "", "improvements": []},
  "qualityScore": 85,
  "seoScore": 85,
  "readabilityScore": 80,
  "engagementScore": 85
}

## ⚠️ FINAL REMINDER - READ THIS:

Your "optimizedContent" field MUST include:
- 1x wp-opt-tldr div (TL;DR box)
- 2-3x wp-opt-tip divs (Pro Tips)
- 1-2x wp-opt-warning divs (Warnings)
- 2-3x wp-opt-insight divs (Key Insights)
- 2-3x wp-opt-stat divs (Stats)
- 1x wp-opt-quote div (Expert Quote)
- 1x wp-opt-takeaways div (Key Takeaways)
- 2x wp-opt-cta divs (CTAs)
- 1x wp-opt-comparison div (Table)
- 1x wp-opt-video div (Video)
- 1x wp-opt-research div (Research)

DO NOT output plain paragraphs without these styled boxes!`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildUserPrompt(
  pageTitle: string,
  pageContent: string,
  keyword: string,
  internalLinks: InternalLinkCandidate[],
  neuronWriter: NeuronWriterRecommendations | null,
  advanced: AdvancedSettings,
  siteContext: SiteContext | undefined
): string {
  const linksSection = internalLinks.length > 0 ? `
INTERNAL LINKS TO USE (pick 10-15):
${internalLinks.slice(0, 30).map(l => `- ${l.title}: ${l.url}`).join('\n')}

ONLY use URLs from this list. Do NOT invent URLs.
` : '';

  const neuronSection = neuronWriter?.status === 'ready' ? `
NEURONWRITER DATA:
- Title Terms: ${neuronWriter.titleTerms || 'N/A'}
- H2 Terms: ${neuronWriter.h2Terms || 'N/A'}
- Content Terms: ${neuronWriter.contentTerms || 'N/A'}
- Questions: ${neuronWriter.questions?.peopleAlsoAsk?.slice(0, 5).join(', ') || 'N/A'}
` : '';

  return `
## TRANSFORM THIS CONTENT INTO BEAUTIFUL HTML:

**Title:** ${pageTitle}
**Keyword:** ${keyword}
**Word Count Required:** ${advanced.minWordCount}-${advanced.maxWordCount} words

**Original Content:**
${pageContent.substring(0, 20000)}

${neuronSection}
${linksSection}

## CRITICAL REQUIREMENTS:

1. optimizedContent MUST be ${advanced.minWordCount}+ words of HTML
2. You MUST include ALL these styled HTML blocks:
   - 1x <div class="wp-opt-tldr"> (TL;DR box - after intro)
   - 2-3x <div class="wp-opt-tip"> (Pro Tips)
   - 1-2x <div class="wp-opt-warning"> (Warnings)
   - 2-3x <div class="wp-opt-insight"> (Insights)
   - 2-3x <div class="wp-opt-stat"> (Stats)
   - 1x <div class="wp-opt-quote"> (Expert Quote)
   - 1x <div class="wp-opt-takeaways"> (Key Takeaways - before conclusion)
   - 2x <div class="wp-opt-cta"> (CTAs - mid + end)
   - 1x <div class="wp-opt-comparison"> (Table)
   - 1x <div class="wp-opt-video"> (Video recommendation)
   - 1x <div class="wp-opt-research"> (Research reference)

3. DO NOT output plain paragraphs without styled boxes
4. Use the EXACT HTML templates from the system prompt
5. Write in Alex Hormozi style

Return ONLY the JSON object. No markdown.`;
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
  
  let apiUrl = `${normalizedUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`;
  logger.info('Fetching page content', { apiUrl });
  
  let response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
      'User-Agent': 'WP-Optimizer-Pro/4.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }

  let posts = await response.json();
  
  if (!posts || posts.length === 0) {
    apiUrl = `${normalizedUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`;
    response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'WP-Optimizer-Pro/4.0',
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

  logger.info('Fetching NeuronWriter', { keyword });

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
  timeoutMs: number = 180000
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
  logger.info('Calling AI', { provider, model });
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
        throw new Error(`Google API error: ${response.status} - ${error.substring(0, 200)}`);
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
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROBUST JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseAIResponse(content: string, logger: Logger): OptimizationResult {
  logger.info('Parsing AI response', { length: content.length });
  
  let cleaned = content.trim();
  
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();
const jsonStart = cleaned.indexOf('{'); const jsonEnd = cleaned.lastIndexOf('}');
if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) { logger.error('No JSON found'); throw new Error('No valid JSON found in AI response'); }
cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
try { cleaned = cleaned.replace(/,\s*([}]])/g, '$1'); const parsed = JSON.parse(cleaned);
text


if (!parsed.optimizedTitle) {
  throw new Error('Missing optimizedTitle');
}
if (!parsed.optimizedContent) {
  throw new Error('Missing optimizedContent');
}
text


logger.info('Parsed successfully');
return parsed as OptimizationResult;
} catch (e) { logger.error('JSON parse error', { error: e instanceof Error ? e.message : 'Unknown' }); throw new Error(Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown'}); } }
// ═══════════════════════════════════════════════════════════════════════════════ // QUALITY VALIDATION WITH STYLED BLOCKS CHECK // ═══════════════════════════════════════════════════════════════════════════════
function validateQuality( result: OptimizationResult, minWordCount: number, logger: Logger ): { valid: boolean; issues: string[]; score: number } { const issues: string[] = []; let score = 100;
const content = result.optimizedContent || ''; const wordCount = content.split(/\s+/).filter(Boolean).length;
// Word count check if (wordCount < minWordCount * 0.8) { issues.push(Word count ${wordCount} below ${minWordCount}); score -= 30; }
// CRITICAL: Check for styled blocks if (!content.includes('wp-opt-tldr')) { issues.push('Missing TL;DR box (wp-opt-tldr)'); score -= 15; } if (!content.includes('wp-opt-takeaways')) { issues.push('Missing Key Takeaways box (wp-opt-takeaways)'); score -= 15; } if (!content.includes('wp-opt-tip')) { issues.push('Missing Pro Tip boxes (wp-opt-tip)'); score -= 10; } if (!content.includes('wp-opt-warning')) { issues.push('Missing Warning box (wp-opt-warning)'); score -= 5; } if (!content.includes('wp-opt-insight')) { issues.push('Missing Insight boxes (wp-opt-insight)'); score -= 5; } if (!content.includes('wp-opt-quote')) { issues.push('Missing Expert Quote (wp-opt-quote)'); score -= 5; } if (!content.includes('wp-opt-stat')) { issues.push('Missing Stat boxes (wp-opt-stat)'); score -= 5; } if (!content.includes('wp-opt-cta')) { issues.push('Missing CTA boxes (wp-opt-cta)'); score -= 5; } if (!content.includes('wp-opt-comparison') && !content.includes('<table')) { issues.push('Missing comparison table'); score -= 5; }
// H2 count const h2Count = (content.match(/<h2/gi) || []).length; if (h2Count < 4) { issues.push(Only ${h2Count} H2s, need 5+); score -= 10; }
logger.info('Quality validation', { wordCount, h2Count, score, issues });
return { valid: score >= 50, issues, score: Math.max(0, score), }; }
function calculateFinalScore(result: OptimizationResult, minWordCount: number): number { let score = 50;
const content = result.optimizedContent || ''; const wordCount = content.split(/\s+/).filter(Boolean).length;
if (wordCount >= minWordCount) score += 15; if (result.tldrSummary?.length >= 4) score += 5; if (result.expertQuote?.quote) score += 5; if (result.faqs?.length >= 5) score += 5; if (result.keyTakeaways?.length >= 5) score += 5;
// Bonus for styled blocks if (content.includes('wp-opt-tldr')) score += 3; if (content.includes('wp-opt-takeaways')) score += 3; if (content.includes('wp-opt-tip')) score += 2; if (content.includes('wp-opt-quote')) score += 2; if (content.includes('wp-opt-stat')) score += 2; if (content.includes('wp-opt-cta')) score += 3;
return Math.min(100, Math.max(0, score)); }
// ═══════════════════════════════════════════════════════════════════════════════ // MAIN SERVE FUNCTION // ═══════════════════════════════════════════════════════════════════════════════
serve(async (req) => { if (req.method === 'OPTIONS') { return new Response(null, { headers: corsHeaders }); }
const logger = new Logger('optimize-content-v4');
try { const request: OptimizeRequest = await req.json(); const { pageId, siteUrl, username, applicationPassword, aiConfig, neuronWriter, advanced, siteContext } = request;
text


logger.info('Request received', { pageId, siteUrl });
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
    throw new Error('Page content too short');
  }
text


  // Step 2: Get keyword
  const keyword = request.targetKeyword || deriveKeyword(title, pageData.slug);
  logger.info('Keyword', { keyword });
text


  // Step 3: Internal links
  await updateJobProgress(supabase, jobId, 'fetching_links', 20, logger);
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


  const { content: aiResponse, tokensUsed } = await callAIWithTimeout(
    provider,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    logger,
    180000
  );
text


  logger.info('AI response received', { tokensUsed, length: aiResponse.length });
text


  // Step 6: Parse
  await updateJobProgress(supabase, jobId, 'processing', 80, logger);
  const optimization = parseAIResponse(aiResponse, logger);
text


  // Step 7: Validate
  await updateJobProgress(supabase, jobId, 'validating', 90, logger);
  const validation = validateQuality(optimization, settings.minWordCount, logger);
text


  if (!validation.valid) {
    logger.warn('Quality issues', { issues: validation.issues });
  }
text


  // Calculate scores
  const qualityScore = calculateFinalScore(optimization, settings.minWordCount);
  optimization.qualityScore = qualityScore;
  optimization.contentStrategy = optimization.contentStrategy || {
    wordCount: optimization.optimizedContent?.split(/\s+/).filter(Boolean).length || 0,
    readabilityScore: 70,
    keywordDensity: 0,
    lsiKeywords: [],
  };
text


  // Step 8: Save
  await updateJobProgress(supabase, jobId, 'saving', 95, logger);
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


  logger.info('Complete!', { qualityScore, wordCount: optimization.contentStrategy.wordCount });
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
  logger.error('Failed', { error: errorMessage });
  await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
  
  return new Response(
    JSON.stringify({ success: false, error: errorMessage, jobId }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
} catch (error) { logger.error('Request error', { error: error instanceof Error ? error.message : 'Unknown' }); return new Response( JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } ); } });
