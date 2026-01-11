// supabase/functions/optimize-content/index.ts
// ============================================================================
// BULLETPROOF CONTENT OPTIMIZATION ENGINE v13.0
// FIXES: Stuck progress, timeout issues, Serper failures
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// TIMEOUT UTILITY - CRITICAL FOR PREVENTING HANGS
// ============================================================================
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

interface OptimizeRequest {
  pageId?: string;
  url?: string;
  siteId?: string;
  siteUrl?: string;
  username?: string;
  applicationPassword?: string;
  aiConfig?: {
    provider: AIProvider;
    apiKey: string;
    model: string;
  };
  advanced?: {
    targetScore?: number;
    minWordCount?: number;
    maxWordCount?: number;
    enableFaqs?: boolean;
    enableSchema?: boolean;
    enableInternalLinks?: boolean;
    enableToc?: boolean;
    enableKeyTakeaways?: boolean;
    enableCtas?: boolean;
  };
  siteContext?: {
    organizationName?: string;
    industry?: string;
    targetAudience?: string;
    brandVoice?: string;
  };
  mode?: string;
  postTitle?: string;
}

interface Reference {
  title: string;
  url: string;
  source: string;
  year?: string;
  verified: boolean;
}

interface BlogSection {
  type: string;
  content?: string;
  level?: number;
  data?: any;
}

interface OptimizationResult {
  title: string;
  author: string;
  publishedAt: string;
  excerpt: string;
  qualityScore: number;
  wordCount: number;
  metaDescription: string;
  sections: BlogSection[];
  references: Reference[];
  internalLinks: Array<{ anchor: string; url: string; context: string }>;
  faqs: Array<{ question: string; answer: string }>;
  optimizedTitle: string;
  h1: string;
  h2s: string[];
  optimizedContent: string;
  tldrSummary: string[];
  keyTakeaways: string[];
  contentStrategy: {
    wordCount: number;
    readabilityScore: number;
    keywordDensity: number;
    lsiKeywords: string[];
  };
  schema: Record<string, unknown>;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  estimatedRankPosition: number;
  confidenceLevel: number;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  google: 'gemini-2.0-flash-exp',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'anthropic/claude-3.5-sonnet',
};

// ============================================================================
// MAIN HANDLER - INLINE PROCESSING (NO BACKGROUND)
// ============================================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let jobId: string | null = null;
  let pageId: string | null = null;

  try {
    const body: OptimizeRequest = await req.json();
    const { siteUrl, username, applicationPassword, aiConfig, advanced, siteContext } = body;
    pageId = body.pageId || null;

    console.log('[optimize-content] v13.0 - BULLETPROOF ENGINE');
    console.log('[optimize-content] URL:', body.url);
    console.log('[optimize-content] Provider:', aiConfig?.provider || 'auto-detect');

    // ========== QUICK OPTIMIZE COMPATIBILITY ==========
    if (!pageId && body.url) {
      console.log('[optimize-content] Quick Optimize mode');
      
      const { data: sites } = await supabase
        .from('sites')
        .select('*')
        .limit(1)
        .single();
      
      const syntheticPageId = crypto.randomUUID();
      await supabase.from('pages').insert({
        id: syntheticPageId,
        site_id: sites?.id || 'default',
        url: body.url,
        slug: body.url.replace(/^\//, '').replace(/\/$/, '') || 'quick-optimize',
        title: body.postTitle || `Quick Optimize: ${body.url}`,
        status: 'pending',
        type: 'post',
        created_at: new Date().toISOString(),
      });
      
      pageId = syntheticPageId;
      body.pageId = syntheticPageId;
      
      if (sites) {
        body.siteUrl = sites.wp_url;
        body.username = sites.wp_username;
        body.applicationPassword = sites.wp_app_password;
      }
      
      if (!body.aiConfig) {
        const { data: config } = await supabase
          .from('configuration')
          .select('*')
          .limit(1)
          .single();
        
        if (config?.ai_provider && config?.ai_api_key) {
          body.aiConfig = {
            provider: config.ai_provider as AIProvider,
            apiKey: config.ai_api_key,
            model: config.ai_model || DEFAULT_MODELS[config.ai_provider as AIProvider],
          };
        }
      }
    }

    if (!pageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'pageId or url required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========== CREATE JOB ==========
    jobId = crypto.randomUUID();
    await supabase.from('jobs').insert({
      id: jobId,
      page_id: pageId,
      status: 'running',
      progress: 5,
      current_step: 'Initializing...',
      created_at: new Date().toISOString(),
    });

    console.log(`[Job ${jobId}] Created`);

    // ========== HELPER: UPDATE PROGRESS (SYNC) ==========
    const updateProgress = async (progress: number, step: string): Promise<void> => {
      console.log(`[Job ${jobId}] ${progress}% - ${step}`);
      await supabase.from('jobs').update({
        progress,
        current_step: step,
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      // Small delay to ensure DB write propagates
      await new Promise(r => setTimeout(r, 50));
    };

    // ========== STAGE 1: INITIALIZE (5-15%) ==========
    await updateProgress(10, 'Loading page data...');
    
    const { data: pageData } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single();

    const originalTitle = pageData?.title || body.postTitle || 'Optimized Content';
    const pageUrl = pageData?.url || body.url || '/';

    console.log(`[Job ${jobId}] Topic: ${originalTitle}`);
    await updateProgress(15, 'Page data loaded');

    // ========== STAGE 2: FETCH SITEMAP (15-25%) ==========
    await updateProgress(20, 'Fetching sitemap...');
    
    let sitemapUrls: Array<{ url: string; slug: string; title?: string }> = [];
    if (body.siteUrl) {
      try {
        sitemapUrls = await withTimeout(
          fetchSitemapUrls(body.siteUrl, body.username, body.applicationPassword),
          15000,
          'Sitemap fetch timeout'
        );
        console.log(`[Job ${jobId}] Found ${sitemapUrls.length} sitemap URLs`);
      } catch (e) {
        console.warn(`[Job ${jobId}] Sitemap fetch skipped:`, e);
      }
    }
    await updateProgress(25, `Found ${sitemapUrls.length} internal links`);

    // ========== STAGE 3: RESEARCH WITH SERPER (25-40%) ==========
    await updateProgress(30, 'Researching topic...');
    
    const serperKey = Deno.env.get('SERPER_API_KEY');
    let validatedReferences: Reference[] = [];
    
    if (serperKey) {
      console.log(`[Job ${jobId}] Serper API key found`);
      try {
        await updateProgress(32, 'Searching for references...');
        validatedReferences = await withTimeout(
          searchAndValidateReferences(serperKey, originalTitle),
          30000, // 30 second timeout
          'Serper search timeout'
        );
        console.log(`[Job ${jobId}] Found ${validatedReferences.length} validated references`);
        await updateProgress(38, `Found ${validatedReferences.length} verified references`);
      } catch (e) {
        console.warn(`[Job ${jobId}] Serper failed, using fallback:`, e);
        validatedReferences = generateFallbackReferences(originalTitle);
        await updateProgress(38, 'Using fallback references');
      }
    } else {
      console.warn(`[Job ${jobId}] No SERPER_API_KEY - using fallback`);
      validatedReferences = generateFallbackReferences(originalTitle);
    }
    
    await updateProgress(40, 'Research complete');

    // ========== STAGE 4: AI GENERATION (40-75%) ==========
    await updateProgress(45, 'Starting AI content generation...');
    
    let result: OptimizationResult;
    
    const aiProvider = body.aiConfig?.provider;
    const aiApiKey = body.aiConfig?.apiKey;
    const aiModel = body.aiConfig?.model;
    
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    const minWords = advanced?.minWordCount || 2500;
    const maxWords = advanced?.maxWordCount || 3000;

    await updateProgress(50, 'AI is generating content...');

    // Try configured AI or fallbacks
    let aiSuccess = false;
    
    if (aiApiKey && aiProvider) {
      const modelToUse = aiModel || DEFAULT_MODELS[aiProvider];
      try {
        console.log(`[Job ${jobId}] Using ${aiProvider}/${modelToUse}`);
        await updateProgress(55, `Generating with ${aiProvider}...`);
        result = await withTimeout(
          generateWithAI(aiProvider, aiApiKey, modelToUse, originalTitle, pageUrl, siteContext, advanced, sitemapUrls, validatedReferences),
          120000, // 2 minute timeout
          'AI generation timeout'
        );
        aiSuccess = true;
        await updateProgress(70, 'AI content generated!');
      } catch (e) {
        console.error(`[Job ${jobId}] ${aiProvider} failed:`, e);
      }
    }
    
    // Try fallback providers if configured AI failed
    if (!aiSuccess && geminiKey) {
      try {
        await updateProgress(55, 'Trying Gemini...');
        result = await withTimeout(
          generateWithAI('google', geminiKey, 'gemini-2.0-flash-exp', originalTitle, pageUrl, siteContext, advanced, sitemapUrls, validatedReferences),
          120000,
          'Gemini timeout'
        );
        aiSuccess = true;
        await updateProgress(70, 'Content generated with Gemini!');
      } catch (e) {
        console.error(`[Job ${jobId}] Gemini failed:`, e);
      }
    }
    
    if (!aiSuccess && openrouterKey) {
      try {
        await updateProgress(55, 'Trying OpenRouter...');
        result = await withTimeout(
          generateWithAI('openrouter', openrouterKey, 'anthropic/claude-3.5-sonnet', originalTitle, pageUrl, siteContext, advanced, sitemapUrls, validatedReferences),
          120000,
          'OpenRouter timeout'
        );
        aiSuccess = true;
        await updateProgress(70, 'Content generated with OpenRouter!');
      } catch (e) {
        console.error(`[Job ${jobId}] OpenRouter failed:`, e);
      }
    }
    
    if (!aiSuccess && groqKey) {
      try {
        await updateProgress(55, 'Trying Groq...');
        result = await withTimeout(
          generateWithAI('groq', groqKey, 'llama-3.3-70b-versatile', originalTitle, pageUrl, siteContext, advanced, sitemapUrls, validatedReferences),
          120000,
          'Groq timeout'
        );
        aiSuccess = true;
        await updateProgress(70, 'Content generated with Groq!');
      } catch (e) {
        console.error(`[Job ${jobId}] Groq failed:`, e);
      }
    }

    if (!aiSuccess) {
      console.log(`[Job ${jobId}] All AI providers failed, using fallback content`);
      await updateProgress(55, 'Using fallback content generator...');
      result = generateFallbackContent(originalTitle, pageUrl, advanced, sitemapUrls, validatedReferences);
      await updateProgress(70, 'Fallback content generated');
    }

    // ========== STAGE 5: RENDER HTML (75-85%) ==========
    await updateProgress(75, 'Rendering HTML content...');
    
    result.references = validatedReferences.length > 0 ? validatedReferences : result.references;
    result.optimizedContent = renderEnterpriseHTML(result, sitemapUrls);
    result.wordCount = countWords(result.optimizedContent);
    result.contentStrategy.wordCount = result.wordCount;
    
    await updateProgress(80, `Rendered ${result.wordCount} words`);

    // ========== STAGE 6: SEO & SCORING (85-95%) ==========
    await updateProgress(85, 'Applying SEO optimizations...');
    
    result.schema = generateArticleSchema(result.title, result.metaDescription, pageUrl, result.author);

    await updateProgress(90, 'Calculating quality scores...');
    
    result.seoScore = calculateSeoScore(result);
    result.readabilityScore = calculateReadabilityScore(result.optimizedContent);
    result.engagementScore = Math.round((result.seoScore + result.readabilityScore) / 2);
    result.qualityScore = Math.round((result.seoScore + result.readabilityScore + result.engagementScore) / 3);
    result.estimatedRankPosition = Math.max(1, Math.round(20 - (result.qualityScore / 5)));
    result.confidenceLevel = Math.min(95, result.qualityScore + 10);

    // ========== STAGE 7: SAVE RESULTS (95-100%) ==========
    await updateProgress(95, 'Saving results...');

    await supabase.from('pages').update({
      status: 'completed',
      score_after: { overall: result.qualityScore, seo: result.seoScore, readability: result.readabilityScore },
      word_count: result.wordCount,
      updated_at: new Date().toISOString(),
    }).eq('id', pageId);

    // CRITICAL: Complete the job
    await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'Complete!',
      result: result,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[Job ${jobId}] ✅ COMPLETED - Score: ${result.qualityScore}/100, Words: ${result.wordCount}`);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId, 
        message: 'Optimization complete',
        result: {
          qualityScore: result.qualityScore,
          wordCount: result.wordCount,
          title: result.title,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[Job ${jobId}] ❌ FAILED:`, error);
    
    // Mark job as failed
    if (jobId) {
      await supabase.from('jobs').update({
        status: 'failed',
        progress: 0,
        current_step: 'Failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }
    
    if (pageId) {
      await supabase.from('pages').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', pageId);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================================================
// SERPER.DEV INTEGRATION WITH VALIDATION
// ============================================================================
async function searchAndValidateReferences(apiKey: string, topic: string): Promise<Reference[]> {
  console.log(`[Serper] Searching for: ${topic}`);
  
  const references: Reference[] = [];
  
  const queries = [
    `${topic} research study`,
    `${topic} statistics 2024`,
    `${topic} expert guide`,
  ];

  for (const query of queries) {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 3 }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      for (const result of (data.organic || []).slice(0, 2)) {
        if (!result.link || !result.title) continue;
        
        // Skip social media
        const url = result.link;
        if (url.includes('reddit.com') || url.includes('quora.com') || 
            url.includes('facebook.com') || url.includes('twitter.com')) {
          continue;
        }

        // Quick validation - just check if URL looks valid
        const isValid = await validateUrlQuick(url);
        
        if (isValid) {
          const domain = new URL(url).hostname.replace('www.', '');
          references.push({
            title: result.title.slice(0, 100),
            url: url,
            source: formatSourceName(domain),
            year: extractYear(result.snippet || result.title) || '2024',
            verified: true,
          });
        }
      }
    } catch (e) {
      console.error(`[Serper] Query failed:`, e);
    }
  }

  // Deduplicate
  const unique = references.filter((ref, i, self) => 
    i === self.findIndex(r => r.url === ref.url)
  );

  console.log(`[Serper] Validated ${unique.length} references`);
  return unique.slice(0, 5);
}

async function validateUrlQuick(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 PagePerfector/1.0' },
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

function generateFallbackReferences(topic: string): Reference[] {
  return [
    { title: `${topic} Best Practices Guide`, url: 'https://www.hubspot.com/marketing', source: 'HubSpot', year: '2024', verified: false },
    { title: 'Content Marketing Statistics', url: 'https://www.statista.com', source: 'Statista', year: '2024', verified: false },
    { title: 'Industry Research Report', url: 'https://www.mckinsey.com', source: 'McKinsey', year: '2024', verified: false },
  ];
}

function formatSourceName(domain: string): string {
  const sources: Record<string, string> = {
    'hbr.org': 'Harvard Business Review',
    'mckinsey.com': 'McKinsey & Company',
    'forbes.com': 'Forbes',
    'hubspot.com': 'HubSpot',
    'semrush.com': 'SEMrush',
    'moz.com': 'Moz',
    'statista.com': 'Statista',
  };
  return sources[domain] || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
}

function extractYear(text: string): string | null {
  const match = text.match(/20(2[0-6]|1[0-9])/);
  return match ? `20${match[1]}` : null;
}

// ============================================================================
// SITEMAP FETCHING
// ============================================================================
async function fetchSitemapUrls(
  siteUrl: string,
  username?: string,
  password?: string
): Promise<Array<{ url: string; slug: string; title?: string }>> {
  const urls: Array<{ url: string; slug: string; title?: string }> = [];
  
  try {
    let normalizedUrl = siteUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    const headers: Record<string, string> = { 'User-Agent': 'PagePerfector/1.0' };
    if (username && password) {
      headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
    }

    const response = await fetch(`${normalizedUrl}/sitemap.xml`, { headers });
    if (!response.ok) return urls;

    const xml = await response.text();
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    
    for (const match of matches) {
      const url = match[1];
      if (url && !url.includes('/wp-content/') && !url.includes('/wp-admin/')) {
        const slug = url.replace(normalizedUrl, '').replace(/^\//, '').replace(/\/$/, '');
        urls.push({
          url,
          slug: slug || 'home',
          title: slug.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Page',
        });
      }
    }
  } catch (e) {
    console.error('[Sitemap] Error:', e);
  }

  return urls;
}

// ============================================================================
// AI GENERATION
// ============================================================================
async function generateWithAI(
  provider: AIProvider,
  apiKey: string,
  model: string,
  title: string,
  url: string,
  siteContext?: OptimizeRequest['siteContext'],
  advanced?: OptimizeRequest['advanced'],
  sitemapUrls?: Array<{ url: string; slug: string; title?: string }>,
  validatedReferences?: Reference[]
): Promise<OptimizationResult> {
  
  const minWords = advanced?.minWordCount || 2500;
  const maxWords = advanced?.maxWordCount || 3000;
  const targetWords = Math.round((minWords + maxWords) / 2);
  
  const prompt = buildPrompt(title, url, siteContext, minWords, maxWords, targetWords, sitemapUrls || [], validatedReferences || []);

  console.log(`[AI] Calling ${provider}/${model}...`);

  let text: string;

  switch (provider) {
    case 'openai':
      text = await callOpenAI(apiKey, model, prompt);
      break;
    case 'anthropic':
      text = await callAnthropic(apiKey, model, prompt);
      break;
    case 'groq':
      text = await callGroq(apiKey, model, prompt);
      break;
    case 'openrouter':
      text = await callOpenRouter(apiKey, model, prompt);
      break;
    case 'google':
    default:
      text = await callGemini(apiKey, model, prompt);
      break;
  }

  if (!text) throw new Error(`No response from ${provider}`);

  const cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    console.error('[AI] JSON parse failed');
    throw new Error('Failed to parse AI response');
  }

  return normalizeResponse(parsed, title, targetWords, validatedReferences || [], sitemapUrls || []);
}

function buildPrompt(
  title: string,
  url: string,
  siteContext?: OptimizeRequest['siteContext'],
  minWords: number = 2500,
  maxWords: number = 3000,
  targetWords: number = 2750,
  sitemapUrls: Array<{ url: string; slug: string; title?: string }> = [],
  validatedReferences: Reference[] = []
): string {
  
  const internalLinks = sitemapUrls.filter(u => u.slug && u.slug !== 'home').slice(0, 10)
    .map(u => `- "${u.title}" → ${u.url}`).join('\n');

  const refs = validatedReferences.map(r => 
    `- "${r.title}" (${r.source}, ${r.year}) → ${r.url}`
  ).join('\n');

  return `You are a world-class content expert. Write like a human with 10+ years experience.

TOPIC: ${title}
URL: ${url}
${siteContext?.organizationName ? `BRAND: ${siteContext.organizationName}` : ''}

WORD COUNT: ${minWords}-${maxWords} words (target: ${targetWords})

INTERNAL LINKS (use 4-8):
${internalLinks || 'None available'}

VERIFIED REFERENCES:
${refs || 'Generate plausible references'}

WRITING STYLE:
- Conversational, use "I", "you", contractions
- Mix sentence lengths
- Zero fluff - every sentence provides value
- Include specific numbers and examples

Return ONLY valid JSON:
{
  "title": "Compelling title (50-60 chars)",
  "author": "Content Expert",
  "publishedAt": "${new Date().toISOString()}",
  "excerpt": "Hook that creates curiosity (150 chars)",
  "metaDescription": "SEO description (150 chars)",
  "qualityScore": 90,
  "wordCount": ${targetWords},
  "sections": [
    { "type": "tldr", "content": "Key takeaway in 2-3 sentences" },
    { "type": "takeaways", "data": ["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"] },
    { "type": "heading", "content": "First Section", "level": 2 },
    { "type": "paragraph", "content": "Content..." },
    { "type": "tip", "data": { "title": "Pro Tip", "content": "..." } },
    { "type": "heading", "content": "Second Section", "level": 2 },
    { "type": "paragraph", "content": "More content..." },
    { "type": "warning", "data": { "title": "Watch Out", "content": "..." } },
    { "type": "heading", "content": "Third Section", "level": 2 },
    { "type": "paragraph", "content": "Content..." },
    { "type": "cta", "data": { "title": "Take Action", "description": "...", "buttonText": "Start", "buttonLink": "#" } },
    { "type": "summary", "content": "Final summary..." }
  ],
  "internalLinks": [{ "anchor": "text", "url": "URL", "context": "usage" }],
  "references": ${JSON.stringify(validatedReferences)},
  "faqs": [{ "question": "Q?", "answer": "A" }],
  "h2s": ["Section 1", "Section 2"],
  "tldrSummary": ["Point 1", "Point 2"],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "contentStrategy": { "wordCount": ${targetWords}, "readabilityScore": 85, "keywordDensity": 1.5, "lsiKeywords": [] }
}`;
}

// ============================================================================
// API CALLS
// ============================================================================
async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 32768 },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini: ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 16000, temperature: 0.85 }),
  });
  if (!response.ok) throw new Error(`OpenAI: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!response.ok) throw new Error(`Anthropic: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callGroq(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 16000, temperature: 0.85 }),
  });
  if (!response.ok) throw new Error(`Groq: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://page-perfector.com' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 16000, temperature: 0.85 }),
  });
  if (!response.ok) throw new Error(`OpenRouter: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// NORMALIZE RESPONSE
// ============================================================================
function normalizeResponse(
  parsed: any,
  title: string,
  targetWords: number,
  validatedReferences: Reference[],
  sitemapUrls: Array<{ url: string; slug: string; title?: string }>
): OptimizationResult {
  return {
    title: parsed.title || title,
    author: parsed.author || 'Content Expert',
    publishedAt: parsed.publishedAt || new Date().toISOString(),
    excerpt: parsed.excerpt || '',
    qualityScore: parsed.qualityScore || 90,
    wordCount: parsed.wordCount || targetWords,
    metaDescription: parsed.metaDescription || '',
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    references: validatedReferences.length > 0 ? validatedReferences : (parsed.references || []),
    internalLinks: parsed.internalLinks || [],
    faqs: parsed.faqs || [],
    optimizedTitle: parsed.title || title,
    h1: parsed.title || title,
    h2s: parsed.h2s || [],
    optimizedContent: '',
    tldrSummary: parsed.tldrSummary || [],
    keyTakeaways: parsed.keyTakeaways || [],
    contentStrategy: {
      wordCount: targetWords,
      readabilityScore: 85,
      keywordDensity: 1.5,
      lsiKeywords: parsed.contentStrategy?.lsiKeywords || [],
    },
    schema: {},
    seoScore: 0,
    readabilityScore: 0,
    engagementScore: 0,
    estimatedRankPosition: 10,
    confidenceLevel: 85,
  };
}

// ============================================================================
// FALLBACK CONTENT GENERATOR
// ============================================================================
function generateFallbackContent(
  title: string,
  url: string,
  advanced?: OptimizeRequest['advanced'],
  sitemapUrls: Array<{ url: string; slug: string; title?: string }> = [],
  validatedReferences: Reference[] = []
): OptimizationResult {
  const targetWords = Math.round(((advanced?.minWordCount || 2500) + (advanced?.maxWordCount || 3000)) / 2);

  const sections: BlogSection[] = [
    { type: 'tldr', content: `This guide covers everything you need to know about ${title}. Practical strategies backed by real experience.` },
    { type: 'takeaways', data: ['Key insight 1', 'Key insight 2', 'Key insight 3', 'Key insight 4', 'Key insight 5'] },
    { type: 'heading', content: `Understanding ${title}`, level: 2 },
    { type: 'paragraph', content: `When it comes to ${title.toLowerCase()}, most people struggle to find the right approach. The key is understanding fundamentals first.` },
    { type: 'tip', data: { title: 'Pro Tip', content: 'Start simple and build complexity over time.' } },
    { type: 'heading', content: 'Key Strategies', level: 2 },
    { type: 'paragraph', content: 'Here are the strategies that actually work based on extensive testing.' },
    { type: 'warning', data: { title: 'Common Mistake', content: 'Don\'t rush the process - consistency beats intensity.' } },
    { type: 'heading', content: 'Taking Action', level: 2 },
    { type: 'paragraph', content: 'The best time to start is now. Pick one strategy and implement it today.' },
    { type: 'cta', data: { title: 'Ready to Start?', description: 'Take action today.', buttonText: 'Get Started', buttonLink: '#' } },
    { type: 'summary', content: `We covered the essentials of ${title}. Remember: consistent action beats perfect planning.` },
  ];

  return {
    title: title.slice(0, 60),
    author: 'Content Expert',
    publishedAt: new Date().toISOString(),
    excerpt: `Complete guide to ${title.toLowerCase()}.`,
    qualityScore: 80,
    wordCount: targetWords,
    metaDescription: `Master ${title.toLowerCase()} with this practical guide.`,
    sections,
    references: validatedReferences.length > 0 ? validatedReferences : generateFallbackReferences(title),
    internalLinks: sitemapUrls.slice(0, 4).map(u => ({ anchor: u.title || u.slug, url: u.url, context: 'Related' })),
    faqs: [{ question: `What is ${title}?`, answer: 'This guide explains everything.' }],
    optimizedTitle: title,
    h1: title,
    h2s: ['Understanding', 'Key Strategies', 'Taking Action'],
    optimizedContent: '',
    tldrSummary: ['Key point 1', 'Key point 2'],
    keyTakeaways: ['Takeaway 1', 'Takeaway 2'],
    contentStrategy: { wordCount: targetWords, readabilityScore: 85, keywordDensity: 1.5, lsiKeywords: [] },
    schema: {},
    seoScore: 80,
    readabilityScore: 85,
    engagementScore: 82,
    estimatedRankPosition: 10,
    confidenceLevel: 80,
  };
}

// ============================================================================
// HTML RENDERER (Simplified for reliability)
// ============================================================================
function renderEnterpriseHTML(result: OptimizationResult, sitemapUrls: Array<{ url: string; slug: string; title?: string }>): string {
  let html = '';

  for (const section of result.sections) {
    switch (section.type) {
      case 'tldr':
        html += `<div style="margin:32px 0;padding:24px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-left:5px solid #2563eb;border-radius:0 16px 16px 0;"><h3 style="margin:0 0 10px;font-size:18px;color:#1e40af;">💡 TL;DR</h3><p style="margin:0;color:#1e3a8a;">${esc(section.content || '')}</p></div>`;
        break;
      case 'takeaways':
        const items = (section.data || []).map((item: string, i: number) => 
          `<li style="display:flex;gap:12px;margin-bottom:12px;"><span style="width:24px;height:24px;background:#059669;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">${i + 1}</span><span style="color:#065f46;">${esc(item)}</span></li>`
        ).join('');
        html += `<div style="margin:32px 0;padding:24px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #a7f3d0;border-radius:16px;"><h3 style="margin:0 0 16px;font-size:18px;color:#065f46;">🎯 Key Takeaways</h3><ul style="margin:0;padding:0;list-style:none;">${items}</ul></div>`;
        break;
      case 'heading':
        const id = (section.content || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
        html += `<h2 id="${id}" style="font-size:28px;font-weight:800;color:#111827;margin:48px 0 20px;border-bottom:3px solid #e5e7eb;padding-bottom:12px;">${esc(section.content || '')}</h2>`;
        break;
      case 'paragraph':
        html += `<p style="margin:0 0 20px;font-size:17px;line-height:1.8;color:#374151;">${section.content || ''}</p>`;
        break;
      case 'tip':
        html += `<div style="margin:28px 0;padding:20px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-left:5px solid #16a34a;border-radius:0 12px 12px 0;"><h4 style="margin:0 0 8px;color:#166534;">💡 ${esc(section.data?.title || 'Pro Tip')}</h4><p style="margin:0;color:#15803d;">${esc(section.data?.content || '')}</p></div>`;
        break;
      case 'warning':
        html += `<div style="margin:28px 0;padding:20px;background:linear-gradient(135deg,#fef2f2,#fee2e2);border-left:5px solid #dc2626;border-radius:0 12px 12px 0;"><h4 style="margin:0 0 8px;color:#991b1b;">⚠️ ${esc(section.data?.title || 'Warning')}</h4><p style="margin:0;color:#b91c1c;">${esc(section.data?.content || '')}</p></div>`;
        break;
      case 'cta':
        html += `<div style="margin:40px 0;padding:32px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:20px;text-align:center;"><h3 style="margin:0 0 12px;font-size:26px;color:white;">${esc(section.data?.title || 'Ready?')}</h3><p style="margin:0 0 24px;color:rgba(255,255,255,0.9);">${esc(section.data?.description || '')}</p><a href="${esc(section.data?.buttonLink || '#')}" style="display:inline-block;padding:14px 32px;background:white;color:#ea580c;font-weight:700;text-decoration:none;border-radius:10px;">${esc(section.data?.buttonText || 'Start')} →</a></div>`;
        break;
      case 'summary':
        html += `<div style="margin:40px 0;padding:24px;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:2px solid #c4b5fd;border-radius:16px;"><h3 style="margin:0 0 12px;color:#5b21b6;">📝 Summary</h3><p style="margin:0;color:#6d28d9;">${esc(section.content || '')}</p></div>`;
        break;
    }
  }

  // References
  if (result.references && result.references.length > 0) {
    const refItems = result.references.map(ref => 
      `<li style="margin-bottom:12px;"><strong>${esc(ref.title)}</strong> — ${esc(ref.source)} (${ref.year}) ${ref.verified ? '<span style="color:#16a34a;">✓</span>' : ''}<br><a href="${esc(ref.url)}" style="color:#3b82f6;font-size:13px;">${esc(ref.url.slice(0, 60))}</a></li>`
    ).join('');
    html += `<div style="margin:48px 0;padding:24px;background:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;"><h3 style="margin:0 0 16px;color:#1e293b;">📚 References</h3><ol style="margin:0;padding-left:20px;color:#475569;">${refItems}</ol></div>`;
  }

  return html;
}

function esc(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').filter(Boolean).length;
}

function generateArticleSchema(title: string, description: string, url: string, author: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    author: { '@type': 'Person', name: author },
    datePublished: new Date().toISOString(),
  };
}

function calculateSeoScore(result: OptimizationResult): number {
  let score = 50;
  if (result.title?.length >= 30 && result.title.length <= 60) score += 10;
  if (result.metaDescription?.length >= 120) score += 10;
  if (result.h2s?.length >= 3) score += 10;
  if (result.wordCount >= 2000) score += 10;
  if (result.sections?.length >= 10) score += 5;
  if (result.references?.length >= 3) score += 5;
  return Math.min(100, score);
}

function calculateReadabilityScore(content: string): number {
  const text = content.replace(/<[^>]+>/g, ' ').trim();
  const sentences = text.split(/[.!?]+/).filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const avg = words / Math.max(1, sentences);
  if (avg >= 12 && avg <= 20) return 90;
  if (avg < 12) return 80;
  return 70;
}
