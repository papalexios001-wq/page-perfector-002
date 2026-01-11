// supabase/functions/optimize-content/index.ts
// ============================================================================
// ENTERPRISE-GRADE CONTENT OPTIMIZATION ENGINE v6.0
// FIXED: Duplicate pageId declaration bug
// FIXED: Quick Optimize compatibility
// FIXED: Proper data structure for frontend BlogPostRenderer
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface OptimizeRequest {
  // Page identification
  pageId?: string;
  url?: string;
  siteId?: string;
  
  // WordPress credentials
  siteUrl?: string;
  username?: string;
  applicationPassword?: string;
  
  // AI Configuration
  aiConfig?: {
    provider: 'openai' | 'anthropic' | 'gemini';
    apiKey: string;
    model: string;
  };
  
  // NeuronWriter (optional)
  neuronWriter?: {
    enabled: boolean;
    apiKey: string;
    projectId: string;
    projectName?: string;
  };
  
  // Advanced settings
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
  
  // Site context
  siteContext?: {
    organizationName?: string;
    industry?: string;
    targetAudience?: string;
    brandVoice?: string;
  };
  
  // Quick optimize specific
  mode?: string;
  postTitle?: string;
}

interface WordPressPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  link: string;
  status: string;
  type: string;
}

// Blog post structure that matches frontend BlogPostRenderer
interface BlogSection {
  type: 'heading' | 'paragraph' | 'tldr' | 'takeaways' | 'quote' | 'cta' | 'video' | 'summary' | 'patent' | 'chart' | 'table';
  content?: string;
  data?: any;
}

interface BlogPostContent {
  title: string;
  author: string;
  publishedAt: string;
  excerpt?: string;
  qualityScore: number;
  wordCount: number;
  metaDescription: string;
  sections: BlogSection[];
}

interface OptimizationResult {
  // Blog post format for frontend rendering
  title: string;
  author: string;
  publishedAt: string;
  excerpt: string;
  qualityScore: number;
  wordCount: number;
  metaDescription: string;
  sections: BlogSection[];
  
  // Legacy fields for backward compatibility
  optimizedTitle: string;
  h1: string;
  h2s: string[];
  optimizedContent: string;
  tldrSummary: string[];
  keyTakeaways: string[];
  faqs: Array<{ question: string; answer: string }>;
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
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  estimatedRankPosition: number;
  confidenceLevel: number;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: OptimizeRequest = await req.json();
    
    // =========================================================================
    // CRITICAL FIX: Use LET for pageId so it can be reassigned
    // This fixes the "Identifier 'pageId' has already been declared" error
    // =========================================================================
    const { siteUrl, username, applicationPassword, aiConfig, advanced, siteContext } = body;
    let pageId = body.pageId; // USE LET, NOT CONST

    console.log('[optimize-content] ====================================');
    console.log('[optimize-content] Request received');
    console.log('[optimize-content] pageId:', pageId);
    console.log('[optimize-content] url:', body.url);
    console.log('[optimize-content] siteUrl:', siteUrl);
    console.log('[optimize-content] hasAiConfig:', !!aiConfig);

    // =========================================================================
    // QUICK OPTIMIZE COMPATIBILITY
    // If only 'url' is provided (from QuickOptimizeButton), create synthetic page
    // =========================================================================
    if (!pageId && body.url) {
      console.log('[optimize-content] Quick Optimize mode detected - url:', body.url);
      
      // Fetch site configuration from database
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .limit(1)
        .single();
      
      if (sitesError) {
        console.log('[optimize-content] No site configured, proceeding with defaults');
      }
      
      // Create synthetic page entry
      const syntheticPageId = crypto.randomUUID();
      const { error: pageInsertError } = await supabase.from('pages').insert({
        id: syntheticPageId,
        site_id: sites?.id || 'default',
        url: body.url,
        slug: body.url.replace(/^\//, '').replace(/\/$/, '') || 'quick-optimize',
        title: body.postTitle || `Quick Optimize: ${body.url}`,
        status: 'pending',
        type: 'post',
        created_at: new Date().toISOString(),
      });
      
      if (pageInsertError) {
        console.error('[optimize-content] Failed to create page:', pageInsertError);
        // Continue anyway - we can still generate content
      }
      
      // CRITICAL FIX: Update the local pageId variable
      pageId = syntheticPageId;
      body.pageId = syntheticPageId;
      
      if (sites) {
        body.siteUrl = sites.wp_url;
        body.username = sites.wp_username;
        body.applicationPassword = sites.wp_app_password;
      }
      
      // Fetch AI config if available
      const { data: config } = await supabase
        .from('configuration')
        .select('*')
        .limit(1)
        .single();
      
      if (config?.ai_provider && config?.ai_api_key) {
        body.aiConfig = {
          provider: config.ai_provider,
          apiKey: config.ai_api_key,
          model: config.ai_model || 'gemini-2.0-flash-exp',
        };
      }
      
      console.log('[optimize-content] Synthetic page created:', syntheticPageId);
    }
    // =========================================================================
    // END QUICK OPTIMIZE COMPATIBILITY
    // =========================================================================

    // Validate pageId exists
    if (!pageId) {
      console.error('[optimize-content] No pageId after compatibility check');
      return new Response(
        JSON.stringify({ success: false, error: 'pageId is required. Provide either pageId or url parameter.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[optimize-content] Using pageId:', pageId);

    // Create job record
    const jobId = crypto.randomUUID();
    const { error: insertError } = await supabase.from('jobs').insert({
      id: jobId,
      page_id: pageId,
      status: 'running',
      progress: 5,
      current_step: 'Starting optimization...',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[optimize-content] Failed to create job:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create job' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[optimize-content] Job created:', jobId);

    // Return immediately with jobId
    const response = new Response(
      JSON.stringify({ success: true, jobId, message: 'Optimization started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Process in background using EdgeRuntime.waitUntil
    EdgeRuntime.waitUntil(
      processOptimization(supabase, jobId, pageId, {
        siteUrl: body.siteUrl || siteUrl,
        username: body.username || username,
        applicationPassword: body.applicationPassword || applicationPassword,
        aiConfig: body.aiConfig || aiConfig,
        advanced,
        siteContext,
        url: body.url,
        postTitle: body.postTitle,
      })
    );

    return response;

  } catch (error) {
    console.error('[optimize-content] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================
async function processOptimization(
  supabase: any,
  jobId: string,
  pageId: string,
  config: {
    siteUrl?: string;
    username?: string;
    applicationPassword?: string;
    aiConfig?: OptimizeRequest['aiConfig'];
    advanced?: OptimizeRequest['advanced'];
    siteContext?: OptimizeRequest['siteContext'];
    url?: string;
    postTitle?: string;
  }
): Promise<void> {
  
  const updateProgress = async (progress: number, step: string) => {
    console.log(`[Job ${jobId}] ${progress}% - ${step}`);
    await supabase.from('jobs').update({
      progress,
      current_step: step,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
  };

  try {
    // ========== STAGE 1: GET PAGE DATA FROM DATABASE ==========
    await updateProgress(10, 'Loading page data...');
    
    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (pageError || !pageData) {
      console.error(`[Job ${jobId}] Page not found:`, pageError);
      // Create a minimal page data object for Quick Optimize
      const minimalPageData = {
        id: pageId,
        url: config.url || '/quick-optimize',
        slug: config.url?.replace(/^\//, '') || 'quick-optimize',
        title: config.postTitle || 'Quick Optimize',
      };
      console.log(`[Job ${jobId}] Using minimal page data:`, minimalPageData);
    }

    const originalTitle = pageData?.title || config.postTitle || 'Optimized Content';
    const pageUrl = pageData?.url || config.url || '/';
    const pageSlug = pageData?.slug || config.url?.replace(/^\//, '') || 'optimized';

    console.log(`[Job ${jobId}] Processing: ${originalTitle}`);

    // ========== STAGE 2: FETCH CONTENT (if WordPress configured) ==========
    await updateProgress(20, 'Analyzing content...');
    
    let wpContent: WordPressPost | null = null;
    let originalContent = '';
    
    if (config.siteUrl && config.username && config.applicationPassword && pageData?.post_id) {
      try {
        wpContent = await fetchWordPressPost(
          config.siteUrl,
          config.username,
          config.applicationPassword,
          pageData.post_id,
          pageData.post_type || 'posts'
        );
        originalContent = wpContent?.content?.rendered || '';
        console.log(`[Job ${jobId}] Fetched WordPress content: ${originalContent.length} chars`);
      } catch (wpError) {
        console.error(`[Job ${jobId}] WordPress fetch failed:`, wpError);
      }
    }

    // ========== STAGE 3: PREPARE FOR AI GENERATION ==========
    await updateProgress(35, 'Preparing AI generation...');
    
    const plainText = stripHtml(originalContent);
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    
    console.log(`[Job ${jobId}] Original word count: ${wordCount}`);

    // ========== STAGE 4: GENERATE OPTIMIZED CONTENT ==========
    await updateProgress(50, 'AI is generating optimized content...');
    
    let result: OptimizationResult;
    
    // Try AI generation
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (config.aiConfig?.apiKey) {
      try {
        console.log(`[Job ${jobId}] Using configured AI: ${config.aiConfig.provider}`);
        result = await generateWithAI(
          config.aiConfig,
          originalTitle,
          plainText || `Content about ${originalTitle}`,
          pageUrl,
          config.siteContext,
          config.advanced
        );
        await updateProgress(75, 'AI generation complete!');
      } catch (aiError) {
        console.error(`[Job ${jobId}] Configured AI failed:`, aiError);
        await updateProgress(60, 'AI failed, using fallback...');
        result = generateEnterpriseContent(originalTitle, plainText, pageUrl, config.advanced);
      }
    } else if (geminiKey) {
      try {
        console.log(`[Job ${jobId}] Using environment Gemini API`);
        result = await generateWithAI(
          { provider: 'gemini', apiKey: geminiKey, model: 'gemini-2.0-flash-exp' },
          originalTitle,
          plainText || `Content about ${originalTitle}`,
          pageUrl,
          config.siteContext,
          config.advanced
        );
        await updateProgress(75, 'AI generation complete!');
      } catch (aiError) {
        console.error(`[Job ${jobId}] Gemini failed:`, aiError);
        result = generateEnterpriseContent(originalTitle, plainText, pageUrl, config.advanced);
      }
    } else {
      console.log(`[Job ${jobId}] No AI configured, using enterprise content generation`);
      result = generateEnterpriseContent(originalTitle, plainText, pageUrl, config.advanced);
    }

    // ========== STAGE 5: POST-PROCESSING ==========
    await updateProgress(85, 'Applying SEO optimizations...');
    
    // Generate schema markup
    result.schema = generateSchema(result.title, result.metaDescription, pageUrl);

    await updateProgress(92, 'Validating quality...');
    
    // Calculate final scores
    result.seoScore = calculateSeoScore(result);
    result.readabilityScore = calculateReadabilityScore(result.optimizedContent);
    result.engagementScore = Math.round((result.seoScore + result.readabilityScore) / 2);
    result.qualityScore = Math.round((result.seoScore + result.readabilityScore + result.engagementScore) / 3);
    result.estimatedRankPosition = Math.max(1, Math.round(20 - (result.qualityScore / 5)));
    result.confidenceLevel = Math.min(95, result.qualityScore + 10);

    // ========== STAGE 6: SAVE RESULTS ==========
    await updateProgress(96, 'Saving results...');

    // Update page status
    await supabase.from('pages').update({
      status: 'completed',
      score_after: { overall: result.qualityScore, seo: result.seoScore, readability: result.readabilityScore },
      word_count: result.wordCount || result.contentStrategy?.wordCount,
      updated_at: new Date().toISOString(),
    }).eq('id', pageId);

    // Complete job with result
    const { error: completeError } = await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'Complete!',
      result: result,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    if (completeError) {
      console.error(`[Job ${jobId}] Failed to save results:`, completeError);
      throw new Error('Failed to save results');
    }

    console.log(`[Job ${jobId}] ✅ COMPLETED - Quality: ${result.qualityScore}/100, Sections: ${result.sections.length}`);

  } catch (error) {
    console.error(`[Job ${jobId}] ❌ FAILED:`, error);
    
    await supabase.from('pages').update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', pageId);
    
    await supabase.from('jobs').update({
      status: 'failed',
      progress: 0,
      current_step: 'Failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

// ============================================================================
// WORDPRESS API
// ============================================================================
async function fetchWordPressPost(
  siteUrl: string,
  username: string,
  password: string,
  postId: number,
  postType: string
): Promise<WordPressPost | null> {
  try {
    let normalizedUrl = siteUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    const endpoint = postType === 'pages' 
      ? `${normalizedUrl}/wp-json/wp/v2/pages/${postId}`
      : `${normalizedUrl}/wp-json/wp/v2/posts/${postId}`;

    const authHeader = 'Basic ' + btoa(`${username}:${password}`);

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'WP-Perfector/1.0',
      },
    });

    if (!response.ok) {
      console.error(`WordPress API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch WordPress post:', error);
    return null;
  }
}

// ============================================================================
// AI GENERATION (OpenAI, Anthropic, Gemini)
// ============================================================================
async function generateWithAI(
  aiConfig: { provider: string; apiKey: string; model: string },
  originalTitle: string,
  originalContent: string,
  pageUrl: string,
  siteContext?: OptimizeRequest['siteContext'],
  advanced?: OptimizeRequest['advanced']
): Promise<OptimizationResult> {
  
  const targetWordCount = advanced?.maxWordCount || 2500;
  
  const prompt = `You are an expert SEO content optimizer and blog writer. Create a comprehensive, engaging blog post.

TOPIC: ${originalTitle}
URL: ${pageUrl}
${siteContext?.organizationName ? `BRAND: ${siteContext.organizationName}` : ''}
${siteContext?.industry ? `INDUSTRY: ${siteContext.industry}` : ''}
${siteContext?.targetAudience ? `AUDIENCE: ${siteContext.targetAudience}` : ''}
${siteContext?.brandVoice ? `TONE: ${siteContext.brandVoice}` : 'Professional but engaging'}

${originalContent ? `ORIGINAL CONTENT TO OPTIMIZE:\n${originalContent.slice(0, 6000)}` : 'Create new content from scratch.'}

REQUIREMENTS:
- Write ${targetWordCount}+ words of high-quality content
- Use short paragraphs (2-3 sentences max)
- Include actionable insights and real examples
- Be direct and value-focused (no fluff)
- Optimize for SEO and featured snippets

Return ONLY valid JSON in this EXACT format:
{
  "title": "Compelling SEO-optimized title (50-60 chars)",
  "author": "Content Expert",
  "publishedAt": "${new Date().toISOString()}",
  "excerpt": "Compelling meta description that drives clicks (150-155 chars)",
  "metaDescription": "Same as excerpt - SEO meta description",
  "qualityScore": 85,
  "wordCount": ${targetWordCount},
  "sections": [
    {
      "type": "tldr",
      "content": "Quick 2-3 sentence summary of the key point readers will learn"
    },
    {
      "type": "takeaways",
      "data": ["Key insight 1", "Key insight 2", "Key insight 3", "Key insight 4", "Key insight 5"]
    },
    {
      "type": "heading",
      "content": "First Major Section Heading"
    },
    {
      "type": "paragraph",
      "content": "First paragraph with valuable content. Use HTML like <strong>bold</strong> and <em>italic</em> for emphasis."
    },
    {
      "type": "paragraph", 
      "content": "Second paragraph continuing the topic with specific examples and data."
    },
    {
      "type": "quote",
      "data": {
        "text": "An insightful quote relevant to the topic",
        "author": "Industry Expert",
        "source": "Source Publication"
      }
    },
    {
      "type": "heading",
      "content": "Second Major Section Heading"
    },
    {
      "type": "paragraph",
      "content": "More valuable content with actionable advice."
    },
    {
      "type": "heading",
      "content": "Third Major Section Heading"  
    },
    {
      "type": "paragraph",
      "content": "Continue with more sections, each with 3-5 paragraphs."
    },
    {
      "type": "cta",
      "data": {
        "title": "Ready to Take Action?",
        "description": "Brief call to action description",
        "buttonText": "Get Started Now",
        "buttonLink": "#contact"
      }
    },
    {
      "type": "summary",
      "content": "Comprehensive summary wrapping up all the key points discussed in the article."
    }
  ],
  "h2s": ["First Section", "Second Section", "Third Section", "Conclusion"],
  "optimizedContent": "<h2>First Section</h2><p>Full HTML content here...</p>",
  "tldrSummary": ["Point 1", "Point 2", "Point 3"],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4", "Takeaway 5"],
  "faqs": [
    {"question": "Common question 1?", "answer": "Detailed answer..."},
    {"question": "Common question 2?", "answer": "Detailed answer..."},
    {"question": "Common question 3?", "answer": "Detailed answer..."}
  ],
  "contentStrategy": {
    "wordCount": ${targetWordCount},
    "readabilityScore": 78,
    "keywordDensity": 1.5,
    "lsiKeywords": ["related term 1", "related term 2", "related term 3"]
  },
  "aiSuggestions": {
    "contentGaps": "Suggestions for additional content",
    "quickWins": "Easy improvements to make",
    "improvements": ["Improvement 1", "Improvement 2", "Improvement 3"]
  }
}

IMPORTANT: 
- Include at least 8-12 sections for a comprehensive article
- Each "heading" should be followed by 2-4 "paragraph" sections
- Make content genuinely useful and actionable
- Return ONLY the JSON, no markdown code blocks`;

  let response: Response;
  let text: string;

  console.log(`[AI] Calling ${aiConfig.provider} API...`);

  if (aiConfig.provider === 'openai') {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    text = data.choices?.[0]?.message?.content || '';

  } else if (aiConfig.provider === 'anthropic') {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': aiConfig.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: aiConfig.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    text = data.content?.[0]?.text || '';

  } else {
    // Gemini (default)
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model || 'gemini-2.0-flash-exp'}:generateContent?key=${aiConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (!text) {
    throw new Error('No content returned from AI');
  }

  console.log(`[AI] Received response, parsing JSON...`);

  // Parse JSON from response
  const cleanJson = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    console.error('[AI] JSON parse error:', parseError);
    console.error('[AI] Raw text:', cleanJson.slice(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }

  // Ensure all required fields exist
  const result: OptimizationResult = {
    // Primary fields for BlogPostRenderer
    title: parsed.title || originalTitle,
    author: parsed.author || 'Content Expert',
    publishedAt: parsed.publishedAt || new Date().toISOString(),
    excerpt: parsed.excerpt || parsed.metaDescription || '',
    qualityScore: parsed.qualityScore || 85,
    wordCount: parsed.wordCount || parsed.contentStrategy?.wordCount || targetWordCount,
    metaDescription: parsed.metaDescription || parsed.excerpt || '',
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    
    // Legacy fields
    optimizedTitle: parsed.title || originalTitle,
    h1: parsed.h1 || parsed.title || originalTitle,
    h2s: Array.isArray(parsed.h2s) ? parsed.h2s : [],
    optimizedContent: parsed.optimizedContent || '',
    tldrSummary: Array.isArray(parsed.tldrSummary) ? parsed.tldrSummary : [],
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
    contentStrategy: {
      wordCount: parsed.contentStrategy?.wordCount || targetWordCount,
      readabilityScore: parsed.contentStrategy?.readabilityScore || 75,
      keywordDensity: parsed.contentStrategy?.keywordDensity || 1.5,
      lsiKeywords: Array.isArray(parsed.contentStrategy?.lsiKeywords) ? parsed.contentStrategy.lsiKeywords : [],
    },
    internalLinks: [],
    schema: {},
    aiSuggestions: {
      contentGaps: parsed.aiSuggestions?.contentGaps || '',
      quickWins: parsed.aiSuggestions?.quickWins || '',
      improvements: Array.isArray(parsed.aiSuggestions?.improvements) ? parsed.aiSuggestions.improvements : [],
    },
    seoScore: 0,
    readabilityScore: 0,
    engagementScore: 0,
    estimatedRankPosition: 10,
    confidenceLevel: 80,
  };

  // Ensure sections array has valid content
  if (result.sections.length === 0) {
    result.sections = [
      { type: 'tldr', content: result.tldrSummary.join(' ') || 'Key insights from this article.' },
      { type: 'takeaways', data: result.keyTakeaways.length > 0 ? result.keyTakeaways : ['Key point 1', 'Key point 2', 'Key point 3'] },
      { type: 'heading', content: 'Introduction' },
      { type: 'paragraph', content: result.optimizedContent || `This comprehensive guide covers everything about ${originalTitle}.` },
      { type: 'summary', content: 'Thank you for reading this guide.' },
    ];
  }

  console.log(`[AI] ✅ Generated content with ${result.sections.length} sections`);
  
  return result;
}

// ============================================================================
// ENTERPRISE CONTENT GENERATION (Fallback when no AI available)
// ============================================================================
function generateEnterpriseContent(
  originalTitle: string,
  originalContent: string,
  pageUrl: string,
  advanced?: OptimizeRequest['advanced']
): OptimizationResult {
  console.log('[Fallback] Generating enterprise content without AI');
  
  const wordCount = originalContent ? originalContent.split(/\s+/).filter(Boolean).length : 0;
  const targetWordCount = Math.max(wordCount, advanced?.minWordCount || 1500);
  
  // Extract keywords from title
  const keywords = originalTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Generate optimized title
  const optimizedTitle = originalTitle.length > 60 
    ? originalTitle.slice(0, 57) + '...' 
    : originalTitle;

  // Generate meta description
  const metaDescription = `Discover everything you need to know about ${originalTitle.toLowerCase()}. Expert insights, actionable strategies, and proven tips for success.`.slice(0, 155);

  // Generate comprehensive sections
  const sections: BlogSection[] = [
    {
      type: 'tldr',
      content: `This comprehensive guide covers the essential aspects of ${originalTitle}. You'll learn practical strategies, expert insights, and actionable tips to achieve your goals.`
    },
    {
      type: 'takeaways',
      data: [
        `Understanding ${keywords[0] || 'the fundamentals'} is crucial for success`,
        'Start with a clear strategy before implementation',
        'Measure your results and iterate based on data',
        'Focus on quality over quantity for lasting results',
        'Stay updated with the latest industry trends and best practices'
      ]
    },
    {
      type: 'heading',
      content: `Understanding ${originalTitle}`
    },
    {
      type: 'paragraph',
      content: `When it comes to ${originalTitle.toLowerCase()}, many people struggle to find the right approach. The key is understanding the <strong>fundamental principles</strong> that drive success in this area. Whether you're a beginner or looking to improve your existing knowledge, this guide provides the insights you need.`
    },
    {
      type: 'paragraph',
      content: `The landscape has evolved significantly in recent years, making it more important than ever to stay informed and adaptable. By following proven strategies and avoiding common pitfalls, you can achieve remarkable results.`
    },
    {
      type: 'quote',
      data: {
        text: 'Success in any field comes from consistent effort, continuous learning, and the willingness to adapt to changing circumstances.',
        author: 'Industry Expert',
        source: 'Professional Insights'
      }
    },
    {
      type: 'heading',
      content: 'Key Strategies for Success'
    },
    {
      type: 'paragraph',
      content: `Implementing the right strategies is essential for achieving your goals with ${originalTitle.toLowerCase()}. Here are the most effective approaches that industry leaders use to drive results.`
    },
    {
      type: 'paragraph',
      content: `<strong>First</strong>, establish clear objectives and metrics for success. <strong>Second</strong>, develop a systematic approach that can be refined over time. <strong>Third</strong>, invest in continuous learning and skill development.`
    },
    {
      type: 'heading',
      content: 'Common Mistakes to Avoid'
    },
    {
      type: 'paragraph',
      content: `Many people make avoidable mistakes when approaching ${originalTitle.toLowerCase()}. By being aware of these pitfalls, you can save time, resources, and frustration on your journey to success.`
    },
    {
      type: 'paragraph',
      content: `The most common mistake is rushing into implementation without proper planning. Take the time to research, plan, and prepare before taking action. This investment upfront will pay dividends in the long run.`
    },
    {
      type: 'heading',
      content: 'Best Practices and Recommendations'
    },
    {
      type: 'paragraph',
      content: `Based on extensive research and real-world experience, these best practices will help you maximize your success with ${originalTitle.toLowerCase()}.`
    },
    {
      type: 'cta',
      data: {
        title: 'Ready to Get Started?',
        description: `Take the first step toward mastering ${originalTitle.toLowerCase()} today. Our expert resources and guides will help you achieve your goals.`,
        buttonText: 'Start Your Journey',
        buttonLink: '#contact'
      }
    },
    {
      type: 'summary',
      content: `In this comprehensive guide, we've covered the essential aspects of ${originalTitle}. From understanding the fundamentals to implementing proven strategies and avoiding common mistakes, you now have the knowledge to succeed. Remember that consistent effort and continuous learning are the keys to long-term success.`
    }
  ];

  // Generate H2s from sections
  const h2s = sections
    .filter(s => s.type === 'heading')
    .map(s => s.content || '');

  return {
    title: optimizedTitle,
    author: 'Content Expert',
    publishedAt: new Date().toISOString(),
    excerpt: metaDescription,
    qualityScore: 78,
    wordCount: targetWordCount,
    metaDescription,
    sections,
    optimizedTitle,
    h1: originalTitle,
    h2s,
    optimizedContent: `<h2>Understanding ${originalTitle}</h2><p>Comprehensive guide content...</p>`,
    tldrSummary: [
      `This guide covers everything about ${originalTitle}`,
      'Learn proven strategies and best practices',
      'Avoid common mistakes and get actionable tips'
    ],
    keyTakeaways: [
      `Understanding ${keywords[0] || 'the basics'} is essential`,
      'Start with a clear strategy before implementation',
      'Measure your results and iterate',
      'Focus on quality over quantity',
      'Stay updated with industry changes'
    ],
    faqs: [
      { question: `What is ${originalTitle}?`, answer: 'This comprehensive guide explains everything you need to know about this topic.' },
      { question: 'How do I get started?', answer: 'Start by understanding the fundamentals covered in this guide, then implement the strategies step by step.' },
      { question: 'What are the main benefits?', answer: 'You\'ll gain actionable knowledge, proven strategies, and expert insights to achieve your goals.' }
    ],
    contentStrategy: {
      wordCount: targetWordCount,
      readabilityScore: 75,
      keywordDensity: 1.5,
      lsiKeywords: keywords.slice(0, 5)
    },
    internalLinks: [],
    schema: {},
    aiSuggestions: {
      contentGaps: 'Consider adding more detailed examples and case studies',
      quickWins: 'Add more subheadings and bullet points for better readability',
      improvements: [
        'Add more internal links to related content',
        'Include relevant statistics and data',
        'Add images with descriptive alt text'
      ]
    },
    seoScore: 75,
    readabilityScore: 78,
    engagementScore: 72,
    estimatedRankPosition: 12,
    confidenceLevel: 75
  };
}

// ============================================================================
// UTILITIES
// ============================================================================
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateSchema(title: string, description: string, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'Content Team',
    },
  };
}

function calculateSeoScore(result: OptimizationResult): number {
  let score = 50;
  
  // Title optimization (50-60 chars ideal)
  if (result.title && result.title.length >= 30 && result.title.length <= 60) score += 10;
  else if (result.title && result.title.length > 0) score += 5;
  
  // Meta description (120-155 chars ideal)
  if (result.metaDescription && result.metaDescription.length >= 120 && result.metaDescription.length <= 155) score += 10;
  else if (result.metaDescription && result.metaDescription.length > 0) score += 5;
  
  // H2 headings (3+ ideal)
  if (result.h2s && result.h2s.length >= 4) score += 10;
  else if (result.h2s && result.h2s.length >= 2) score += 5;
  
  // Content length (1500+ words ideal)
  if (result.wordCount >= 2000) score += 10;
  else if (result.wordCount >= 1000) score += 5;
  
  // LSI keywords
  if (result.contentStrategy?.lsiKeywords?.length >= 5) score += 5;
  else if (result.contentStrategy?.lsiKeywords?.length >= 2) score += 3;
  
  // FAQs present
  if (result.faqs && result.faqs.length >= 3) score += 5;
  
  // Sections present (for rich content)
  if (result.sections && result.sections.length >= 8) score += 10;
  else if (result.sections && result.sections.length >= 4) score += 5;
  
  return Math.min(100, score);
}

function calculateReadabilityScore(content: string): number {
  if (!content) return 65;
  
  const plainText = stripHtml(content);
  const sentences = plainText.split(/[.!?]+/).filter(Boolean).length;
  const words = plainText.split(/\s+/).filter(Boolean).length;
  const avgWordsPerSentence = words / Math.max(1, sentences);
  
  // Ideal: 15-20 words per sentence
  if (avgWordsPerSentence >= 12 && avgWordsPerSentence <= 22) {
    return 82;
  } else if (avgWordsPerSentence < 12) {
    return 75; // Sentences too short (choppy)
  } else if (avgWordsPerSentence > 30) {
    return 55; // Sentences too long
  } else {
    return 68;
  }
}
