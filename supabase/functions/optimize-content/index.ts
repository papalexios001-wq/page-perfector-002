// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO ULTRA - ENTERPRISE CONTENT OPTIMIZATION ENGINE v5.0
// 🔥 CRITICAL FIX: Forces AI to output BEAUTIFUL STYLED HTML components
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════════
class Logger {
  private requestId: string;
  private startTime: number;

  constructor(requestId?: string) {
    this.requestId = requestId || crypto.randomUUID();
    this.startTime = Date.now();
  }

  private log(level: string, message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      message,
      data,
      duration: Date.now() - this.startTime,
    }));
  }

  info(message: string, data?: Record<string, unknown>) { this.log('info', message, data); }
  warn(message: string, data?: Record<string, unknown>) { this.log('warn', message, data); }
  error(message: string, data?: Record<string, unknown>) { this.log('error', message, data); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

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
}

interface NeuronWriterRecommendations {
  status: string;
  targetWordCount?: number;
  titleTerms?: string;
  h2Terms?: string;
  contentTerms?: string;
  questions?: { peopleAlsoAsk: string[] };
}

interface InternalLink {
  url: string;
  title: string;
}

interface OptimizeRequest {
  pageId: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
  targetKeyword?: string;
  language?: string;
  aiConfig?: { provider: AIProvider; apiKey: string; model: string };
  neuronWriter?: { enabled: boolean; apiKey: string; projectId: string };
  advanced?: AdvancedSettings;
  siteContext?: SiteContext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥🔥🔥 THE MAGIC: SYSTEM PROMPT THAT FORCES BEAUTIFUL HTML OUTPUT 🔥🔥🔥
// ═══════════════════════════════════════════════════════════════════════════════
function buildSystemPrompt(settings: AdvancedSettings): string {
  return `You are an expert content optimizer. Your job is to transform content into BEAUTIFULLY FORMATTED HTML blog posts with styled visual components.

## ⚠️⚠️⚠️ CRITICAL RULE #1: YOU MUST OUTPUT HTML WITH STYLED DIV BLOCKS ⚠️⚠️⚠️

The "optimizedContent" field MUST contain HTML with styled <div> blocks using specific CSS classes.

DO NOT output plain paragraphs. You MUST use the styled HTML components shown below.
If you output plain text without these styled boxes, YOU HAVE FAILED THE TASK.

## ⚠️ CRITICAL RULE #2: WORD COUNT ${settings.minWordCount}-${settings.maxWordCount} WORDS

## ✍️ WRITING STYLE: ALEX HORMOZI
- Short punchy sentences (1-2 sentences per paragraph max)
- Specific numbers: "3x faster" not "much faster"
- Pattern interrupts every 200 words
- End each H2 with a mic-drop statement

## 📦 MANDATORY HTML COMPONENTS - USE THESE EXACT STRUCTURES:

### 1. TL;DR BOX (Immediately after opening paragraph)
<div class="wp-opt-tldr">
<strong>⚡ TL;DR — The Bottom Line</strong>
<ul>
<li>💡 [First key insight with specific number or stat]</li>
<li>🎯 [Second point - contrarian or surprising take]</li>
<li>⚡ [Third point - actionable tip they can use today]</li>
<li>🔥 [Fourth point - bold statement that challenges assumptions]</li>
<li>📈 [Fifth point - expected outcome or result]</li>
</ul>
</div>

### 2. PRO TIP BOX (Use 2-3 throughout article)
<div class="wp-opt-tip">
<strong>💰 Pro Tip</strong>
<p>[Insider knowledge, shortcut, or actionable advice that saves time/money]</p>
</div>

### 3. WARNING BOX (Use 1-2 in article)
<div class="wp-opt-warning">
<strong>⚠️ Common Mistake</strong>
<p>[What readers should avoid doing and why it hurts them]</p>
</div>

### 4. KEY INSIGHT BOX (Use 2-3 throughout)
<div class="wp-opt-insight">
<strong>💡 Key Insight</strong>
<p>[Non-obvious observation backed by data or real experience]</p>
</div>

### 5. STAT BOX (Use for impressive numbers)
<div class="wp-opt-stat">
<strong>[NUMBER]%</strong>
<p>[What this number means for the reader]</p>
</div>

### 6. EXPERT QUOTE BOX
<div class="wp-opt-quote">
<p>"[Impactful quote from a real industry expert - can be paraphrased]"</p>
<cite>— [Expert Name], [Their Title/Company]</cite>
</div>

### 7. KEY TAKEAWAYS BOX (Before conclusion - REQUIRED)
<div class="wp-opt-takeaways">
<strong>🎯 Key Takeaways</strong>
<ul>
<li>✅ [First specific, actionable takeaway]</li>
<li>✅ [Second takeaway - something they can implement today]</li>
<li>✅ [Third takeaway - ties back to main benefit]</li>
<li>✅ [Fourth takeaway - addresses a common objection]</li>
<li>✅ [Fifth takeaway - the "if you remember nothing else" point]</li>
</ul>
</div>

### 8. CTA BOX (Use at mid-content and end)
<div class="wp-opt-cta">
<strong>[Compelling headline with urgency or value]</strong>
<p>[1-2 sentences explaining the value proposition]</p>
<a href="#">[Action Button Text] →</a>
</div>

### 9. COMPARISON TABLE
<div class="wp-opt-comparison">
<table>
<thead>
<tr>
<th>Factor</th>
<th>Option A</th>
<th>Option B</th>
</tr>
</thead>
<tbody>
<tr><td>[Factor 1]</td><td>[Value]</td><td>[Value]</td></tr>
<tr><td>[Factor 2]</td><td>[Value]</td><td>[Value]</td></tr>
<tr><td>[Factor 3]</td><td>[Value]</td><td>[Value]</td></tr>
</tbody>
</table>
</div>

### 10. VIDEO RECOMMENDATION
<div class="wp-opt-video">
<strong>🎬 Watch This</strong>
<p>Search YouTube: "[specific search query to find relevant video]"</p>
<p>[Why this video is valuable to the reader]</p>
</div>

### 11. RESEARCH REFERENCE
<div class="wp-opt-research">
<strong>📊 The Research Says</strong>
<p><strong>[Study/Source Name]:</strong> [Key finding in plain language]</p>
<p>[Why this matters to the reader's situation]</p>
</div>

## 📋 REQUIRED CONTENT STRUCTURE:

1. <h1>[SEO-Optimized Title]</h1>
2. Opening paragraph (2-3 sentences, hook the reader immediately)
3. <div class="wp-opt-tldr">...</div> ← TL;DR BOX HERE
4. <h2>[Question-Format H2]?</h2>
   - 2-3 paragraphs
   - <div class="wp-opt-tip">...</div> ← PRO TIP
5. <h2>[Question-Format H2]?</h2>
   - 2-3 paragraphs
   - <div class="wp-opt-insight">...</div> ← KEY INSIGHT
   - <div class="wp-opt-stat">...</div> ← STAT BOX
6. <h2>[Question-Format H2]?</h2>
   - 2-3 paragraphs
   - <div class="wp-opt-warning">...</div> ← WARNING
   - <div class="wp-opt-quote">...</div> ← EXPERT QUOTE
7. <h2>[Question-Format H2]?</h2>
   - 2-3 paragraphs
   - <div class="wp-opt-comparison">...</div> ← TABLE
   - <div class="wp-opt-cta">...</div> ← MID CTA
8. <h2>[Question-Format H2]?</h2>
   - 2-3 paragraphs
   - <div class="wp-opt-tip">...</div> ← ANOTHER PRO TIP
   - <div class="wp-opt-research">...</div> ← RESEARCH
9. <div class="wp-opt-takeaways">...</div> ← KEY TAKEAWAYS (REQUIRED)
10. Conclusion paragraph (2-3 sentences)
11. <div class="wp-opt-cta">...</div> ← FINAL CTA

## 📤 JSON OUTPUT FORMAT:

Return ONLY valid JSON. No markdown code fences. No explanations.

{
  "optimizedTitle": "SEO title under 60 chars with primary keyword",
  "metaDescription": "Compelling 150-160 char description with CTA",
  "h1": "Main H1 heading",
  "h2s": ["H2 Question 1?", "H2 Question 2?", "H2 Question 3?", "H2 Question 4?", "H2 Question 5?"],
  "tldrSummary": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "expertQuote": {"quote": "...", "author": "...", "role": "..."},
  "optimizedContent": "<FULL HTML WITH ALL wp-opt-* STYLED DIVS - ${settings.minWordCount}+ WORDS>",
  "faqs": [{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4", "Takeaway 5"],
  "contentStrategy": {"wordCount": ${settings.minWordCount}, "readabilityScore": 75, "keywordDensity": 0.02, "lsiKeywords": []},
  "qualityScore": 85,
  "seoScore": 85,
  "readabilityScore": 80,
  "engagementScore": 85
}

## ⚠️ FINAL CHECKLIST - YOUR optimizedContent MUST INCLUDE:

✅ 1x <div class="wp-opt-tldr"> (TL;DR box after intro)
✅ 2-3x <div class="wp-opt-tip"> (Pro Tips throughout)
✅ 1-2x <div class="wp-opt-warning"> (Warning boxes)
✅ 2-3x <div class="wp-opt-insight"> (Key Insights)
✅ 2-3x <div class="wp-opt-stat"> (Stat callouts)
✅ 1x <div class="wp-opt-quote"> (Expert Quote)
✅ 1x <div class="wp-opt-takeaways"> (Key Takeaways before conclusion)
✅ 2x <div class="wp-opt-cta"> (CTAs - mid and end)
✅ 1x <div class="wp-opt-comparison"> (Comparison table)
✅ 1x <div class="wp-opt-video"> (Video recommendation)
✅ 1x <div class="wp-opt-research"> (Research reference)
✅ 5+ <h2> headings in question format
✅ ${settings.minWordCount}+ total words

If ANY of these are missing, you have FAILED. Output HTML, not plain text!`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildUserPrompt(
  title: string,
  content: string,
  keyword: string,
  links: InternalLink[],
  neuron: NeuronWriterRecommendations | null,
  settings: AdvancedSettings,
  context: SiteContext | undefined
): string {
  const linksSection = links.length > 0 
    ? `\n\nINTERNAL LINKS TO USE (10-15 throughout):\n${links.slice(0, 30).map(l => `- ${l.title}: ${l.url}`).join('\n')}\n\nONLY use URLs from this list.`
    : '';

  const neuronSection = neuron?.status === 'ready'
    ? `\n\nNEURONWRITER DATA:\n- Terms for title: ${neuron.titleTerms || 'N/A'}\n- Terms for H2s: ${neuron.h2Terms || 'N/A'}\n- Content terms: ${neuron.contentTerms || 'N/A'}\n- Questions: ${neuron.questions?.peopleAlsoAsk?.slice(0, 5).join(', ') || 'N/A'}`
    : '';

  return `## TRANSFORM THIS CONTENT INTO BEAUTIFUL HTML:

**Title:** ${title}
**Primary Keyword:** ${keyword}
**Required Word Count:** ${settings.minWordCount}-${settings.maxWordCount} words

**Original Content:**
${content.substring(0, 20000)}
${neuronSection}
${linksSection}

## CRITICAL REQUIREMENTS:

1. Your "optimizedContent" MUST be ${settings.minWordCount}+ words of HTML
2. You MUST include ALL these styled HTML components:
   - 1x wp-opt-tldr (TL;DR box)
   - 2-3x wp-opt-tip (Pro Tips)
   - 1-2x wp-opt-warning (Warnings)
   - 2-3x wp-opt-insight (Insights)
   - 2-3x wp-opt-stat (Stats)
   - 1x wp-opt-quote (Expert Quote)
   - 1x wp-opt-takeaways (Key Takeaways)
   - 2x wp-opt-cta (CTAs)
   - 1x wp-opt-comparison (Table)
   - 1x wp-opt-video (Video recommendation)
   - 1x wp-opt-research (Research reference)
3. Write in Alex Hormozi style - punchy, direct, specific numbers
4. 5+ H2 headings in question format

Return ONLY the JSON. No code fences. No markdown.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function updateJob(
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
    logger.warn('Progress update failed');
  }
}

async function failJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  pageId: string,
  error: string,
  logger: Logger
) {
  await supabase.from('jobs').update({
    status: 'failed',
    error_message: error,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
  await supabase.from('pages').update({ status: 'failed' }).eq('id', pageId);
  logger.error('Job failed', { error });
}

function deriveKeyword(title: string, slug: string): string {
  let kw = title.replace(/\s*[-|–—]\s*.*$/, '').replace(/[^\w\s]/g, ' ').trim().toLowerCase();
  if (kw.length < 10 && slug) kw = slug.replace(/-/g, ' ').trim();
  return kw.substring(0, 100);
}

async function fetchPage(siteUrl: string, pageUrl: string, user: string, pass: string, logger: Logger) {
  const url = siteUrl.replace(/\/+$/, '');
  const auth = 'Basic ' + btoa(`${user}:${pass.replace(/\s+/g, '')}`);
  const slug = pageUrl.split('/').filter(Boolean).pop() || '';
  
  let apiUrl = `${url}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`;
  let res = await fetch(apiUrl, { headers: { Authorization: auth, Accept: 'application/json' } });
  let posts = await res.json();
  
  if (!posts?.length) {
    apiUrl = `${url}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`;
    res = await fetch(apiUrl, { headers: { Authorization: auth, Accept: 'application/json' } });
    posts = await res.json();
  }
  
  if (!posts?.length) throw new Error('Page not found');
  
  return {
    title: posts[0].title?.raw || posts[0].title?.rendered || '',
    content: posts[0].content?.raw || posts[0].content?.rendered || '',
  };
}

async function fetchLinks(supabase: ReturnType<typeof createClient>, siteId: string | null, pageId: string): Promise<InternalLink[]> {
  try {
    let q = supabase.from('pages').select('url, title').neq('id', pageId).limit(100);
    if (siteId) q = q.eq('site_id', siteId);
    const { data } = await q;
    return (data || []).map(p => ({ url: p.url, title: p.title }));
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CALL
// ═══════════════════════════════════════════════════════════════════════════════
async function callAI(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger
): Promise<string> {
  const maxTokens = 16000;
  logger.info('Calling AI', { provider, model });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    let response: Response;
    let result: string = '';

    switch (provider) {
      case 'google': {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
          }),
        });
        const data = await response.json();
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        break;
      }

      case 'openai': {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });
        const data = await response.json();
        result = data.choices?.[0]?.message?.content || '';
        break;
      }

      case 'anthropic': {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        const data = await response.json();
        result = data.content?.[0]?.text || '';
        break;
      }

      case 'groq': {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });
        const data = await response.json();
        result = data.choices?.[0]?.message?.content || '';
        break;
      }

      case 'openrouter': {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });
        const data = await response.json();
        result = data.choices?.[0]?.message?.content || '';
        break;
      }
    }

    clearTimeout(timeout);
    return result;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════
function parseResponse(content: string, logger: Logger): Record<string, unknown> {
  let cleaned = content.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}'); if (start === -1 || end === -1) throw new Error('No JSON found');
cleaned = cleaned.slice(start, end + 1).replace(/,\s*([}]])/g, '$1');
const parsed = JSON.parse(cleaned); if (!parsed.optimizedTitle || !parsed.optimizedContent) { throw new Error('Missing required fields'); }
return parsed; }
// ═══════════════════════════════════════════════════════════════════════════════ // QUALITY VALIDATION - CHECK FOR STYLED COMPONENTS // ═══════════════════════════════════════════════════════════════════════════════ function validateQuality(result: Record<string, unknown>, minWords: number, logger: Logger): { score: number; issues: string[] } { const issues: string[] = []; let score = 100;
const content = (result.optimizedContent as string) || ''; const words = content.split(/\s+/).filter(Boolean).length;
// Word count if (words < minWords * 0.8) { issues.push(Word count ${words} below ${minWords}); score -= 30; }
// CRITICAL: Check for styled components const requiredComponents = [ { class: 'wp-opt-tldr', name: 'TL;DR box', penalty: 15 }, { class: 'wp-opt-takeaways', name: 'Key Takeaways', penalty: 15 }, { class: 'wp-opt-tip', name: 'Pro Tip boxes', penalty: 10 }, { class: 'wp-opt-insight', name: 'Insight boxes', penalty: 5 }, { class: 'wp-opt-warning', name: 'Warning box', penalty: 5 }, { class: 'wp-opt-quote', name: 'Expert Quote', penalty: 5 }, { class: 'wp-opt-stat', name: 'Stat boxes', penalty: 5 }, { class: 'wp-opt-cta', name: 'CTA boxes', penalty: 5 }, { class: 'wp-opt-comparison', name: 'Comparison table', penalty: 5 }, ];
for (const comp of requiredComponents) { if (!content.includes(comp.class)) { issues.push(Missing ${comp.name} (${comp.class})); score -= comp.penalty; } }
// H2 count const h2s = (content.match(/<h2/gi) || []).length; if (h2s < 4) { issues.push(Only ${h2s} H2s (need 5+)); score -= 10; }
logger.info('Quality check', { words, h2s, score, issues }); return { score: Math.max(0, score), issues }; }
// ═══════════════════════════════════════════════════════════════════════════════ // MAIN HANDLER // ═══════════════════════════════════════════════════════════════════════════════ serve(async (req) => { if (req.method === 'OPTIONS') { return new Response(null, { headers: corsHeaders }); }
const logger = new Logger();
try { const request: OptimizeRequest = await req.json(); const { pageId, siteUrl, username, applicationPassword, aiConfig, neuronWriter, advanced, siteContext } = request;
text


logger.info('Request received', { pageId, siteUrl });
text


if (!pageId || !siteUrl || !username || !applicationPassword) {
  return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
text


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
text


// Get page
const { data: page, error: pageErr } = await supabase.from('pages').select('*').eq('id', pageId).single();
if (pageErr || !page) {
  return new Response(JSON.stringify({ success: false, error: 'Page not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
text


// Create job
const { data: job } = await supabase.from('jobs').insert({
  page_id: pageId,
  status: 'running',
  current_step: 'starting',
  progress: 5,
  started_at: new Date().toISOString(),
}).select().single();
text


if (!job) {
  return new Response(JSON.stringify({ success: false, error: 'Failed to create job' }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
text


const jobId = job.id;
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
  await updateJob(supabase, jobId, 'fetching', 10, logger);
  const { title, content } = await fetchPage(siteUrl, page.url, username, applicationPassword, logger);
  if (content.length < 100) throw new Error('Content too short');
text


  // Step 2: Get keyword
  const keyword = request.targetKeyword || deriveKeyword(title, page.slug);
  logger.info('Keyword', { keyword });
text


  // Step 3: Get links
  await updateJob(supabase, jobId, 'links', 20, logger);
  const links = await fetchLinks(supabase, page.site_id, pageId);
text


  // Step 4: Build prompts
  await updateJob(supabase, jobId, 'generating', 40, logger);
  const systemPrompt = buildSystemPrompt(settings);
  const userPrompt = buildUserPrompt(title, content, keyword, links, null, settings, siteContext);
text


  // Step 5: Call AI
  const provider = aiConfig?.provider || 'google';
  const apiKey = aiConfig?.apiKey || Deno.env.get('GOOGLE_API_KEY') || '';
  const model = aiConfig?.model || 'gemini-2.0-flash';
text


  if (!apiKey) throw new Error('No API key');
text


  await updateJob(supabase, jobId, 'ai_processing', 50, logger);
  const aiResponse = await callAI(provider, apiKey, model, systemPrompt, userPrompt, logger);
text


  // Step 6: Parse
  await updateJob(supabase, jobId, 'parsing', 80, logger);
  const result = parseResponse(aiResponse, logger);
text


  // Step 7: Validate
  await updateJob(supabase, jobId, 'validating', 90, logger);
  const { score, issues } = validateQuality(result, settings.minWordCount, logger);
  
  if (issues.length > 0) {
    logger.warn('Quality issues', { issues });
  }
text


  // Step 8: Save
  await updateJob(supabase, jobId, 'saving', 95, logger);
  
  const wordCount = ((result.optimizedContent as string) || '').split(/\s+/).filter(Boolean).length;
text


  await supabase.from('jobs').update({
    status: 'completed',
    progress: 100,
    current_step: 'completed',
    result,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
text


  await supabase.from('pages').update({
    status: 'completed',
    score_after: { overall: score },
    word_count: wordCount,
    updated_at: new Date().toISOString(),
  }).eq('id', pageId);
text


  await supabase.from('activity_log').insert({
    page_id: pageId,
    job_id: jobId,
    type: 'success',
    message: `Optimized: Score ${score}, ${wordCount} words`,
  });
text


  logger.info('Complete!', { score, wordCount });
text


  return new Response(JSON.stringify({ success: true, jobId, optimization: result }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
text


} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  await failJob(supabase, jobId, pageId, msg, logger);
  return new Response(JSON.stringify({ success: false, error: msg, jobId }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
} catch (error) { logger.error('Fatal error', { error: error instanceof Error ? error.message : 'Unknown' }); return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } });
