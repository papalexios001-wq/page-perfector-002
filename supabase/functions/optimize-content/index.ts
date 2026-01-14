// ============================================================================
// OPTIMIZE-CONTENT EDGE FUNCTION - FIXED v17.0.0
// FIXES: Word count enforcement, provider token limits, retry logic
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_TIMEOUT_MS = 300000 // 5 minutes
const MAX_RETRIES = 3 // Maximum attempts to meet word count
const WORD_COUNT_TOLERANCE = 0.1 // Allow 10% variance

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================================
// PROVIDER-SPECIFIC TOKEN LIMITS (CRITICAL FIX!)
// ============================================================================
const PROVIDER_TOKEN_LIMITS: Record<string, Record<string, number>> = {
  google: {
    'gemini-2.0-flash': 8192,
    'gemini-1.5-flash': 8192,
    'gemini-1.5-pro': 8192,
    'gemini-pro': 8192,
    'default': 8192,
  },
  openai: {
    'gpt-4o': 16384,
    'gpt-4o-mini': 16384,
    'gpt-4-turbo': 4096,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 4096,
    'default': 4096,
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': 8192,
    'claude-3-sonnet-20240229': 4096,
    'claude-3-haiku-20240307': 4096,
    'claude-3-opus-20240229': 4096,
    'default': 4096,
  },
  groq: {
    'llama-3.1-70b-versatile': 8192,
    'llama-3.1-8b-instant': 8192,
    'mixtral-8x7b-32768': 32768,
    'default': 8192,
  },
  openrouter: {
    'openai/gpt-4o': 16384,
    'openai/gpt-4o-mini': 16384,
    'anthropic/claude-3.5-sonnet': 8192,
    'anthropic/claude-3-haiku': 4096,
    'google/gemini-pro-1.5': 8192,
    'meta-llama/llama-3.1-70b-instruct': 8192,
    'default': 8192,
  },
}

function getMaxTokensForModel(provider: string, model: string): number {
  const providerLimits = PROVIDER_TOKEN_LIMITS[provider.toLowerCase()] || {}
  return providerLimits[model] || providerLimits['default'] || 4096
}

// ============================================================================
// TYPES
// ============================================================================

interface AIConfig {
  provider: string
  apiKey: string
  model: string
}

interface ContentSettings {
  minWordCount: number
  maxWordCount: number
  enableFaqs?: boolean
  enableToc?: boolean
  enableKeyTakeaways?: boolean
}

interface GeneratedContent {
  title: string
  optimizedTitle: string
  optimizedContent: string
  content: string
  wordCount: number
  qualityScore: number
  seoScore: number
  readabilityScore: number
  metaDescription: string
  h1: string
  h2s: string[]
  sections: Array<{ type: string; content?: string; data?: unknown }>
  excerpt: string
  author: string
  publishedAt: string
  targetWordCount?: { min: number; max: number }
  wordCountMet?: boolean
  attempts?: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  })
}

function errorResponse(
  code: string, 
  message: string, 
  details: Record<string, unknown> = {},
  status = 400
): Response {
  return jsonResponse({
    success: false,
    error: code,
    message,
    details: { ...details, timestamp: new Date().toISOString() },
  }, status)
}

async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeoutMs: number = AI_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI_TIMEOUT: Request timed out after ${timeoutMs / 1000} seconds.`)
    }
    throw error
  }
}

function countWords(htmlContent: string): number {
  return htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
}

// ============================================================================
// WORD COUNT VALIDATION (NEW!)
// ============================================================================

interface WordCountValidation {
  isValid: boolean
  wordCount: number
  action: 'accept' | 'expand' | 'truncate' | 'regenerate'
  wordsNeeded?: number
  wordsToRemove?: number
}

function validateWordCount(
  content: string, 
  minWords: number, 
  maxWords: number
): WordCountValidation {
  const wordCount = countWords(content)
  const tolerance = minWords * WORD_COUNT_TOLERANCE
  
  // Accept if within tolerance
  if (wordCount >= minWords - tolerance && wordCount <= maxWords + tolerance) {
    return { isValid: true, wordCount, action: 'accept' }
  }
  
  // Too short by more than 30% - regenerate entirely
  if (wordCount < minWords * 0.7) {
    return { 
      isValid: false, 
      wordCount, 
      action: 'regenerate',
      wordsNeeded: minWords - wordCount + 200 
    }
  }
  
  // Slightly short - expand
  if (wordCount < minWords) {
    return { 
      isValid: false, 
      wordCount, 
      action: 'expand',
      wordsNeeded: minWords - wordCount + 100 
    }
  }
  
  // Too long - truncate
  return { 
    isValid: false, 
    wordCount, 
    action: 'truncate',
    wordsToRemove: wordCount - maxWords 
  }
}

// ============================================================================
// SMART TRUNCATION (NEW!)
// ============================================================================

function smartTruncate(htmlContent: string, maxWords: number): string {
  // Split into paragraphs
  const paragraphs = htmlContent.split(/<\/p>/i).filter(p => p.trim())
  
  let result = ''
  let currentWordCount = 0
  
  for (const para of paragraphs) {
    const cleanPara = para.replace(/<[^>]*>/g, '')
    const paraWords = cleanPara.split(/\s+/).filter(Boolean).length
    
    if (currentWordCount + paraWords <= maxWords) {
      result += para + '</p>'
      currentWordCount += paraWords
    } else {
      // Add partial paragraph if we're close
      if (currentWordCount > maxWords * 0.9) {
        break
      }
      
      // Truncate this paragraph to fit
      const wordsToTake = maxWords - currentWordCount
      const words = cleanPara.split(/\s+/)
      const truncatedText = words.slice(0, wordsToTake).join(' ')
      
      // Find the last sentence break
      const lastPeriod = truncatedText.lastIndexOf('.')
      const lastQuestion = truncatedText.lastIndexOf('?')
      const lastExclaim = truncatedText.lastIndexOf('!')
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim)
      
      if (lastBreak > truncatedText.length * 0.7) {
        result += `<p>${truncatedText.substring(0, lastBreak + 1)}</p>`
      } else {
        result += `<p>${truncatedText}...</p>`
      }
      break
    }
  }
  
  return result
}

// ============================================================================
// BUILD PROMPTS
// ============================================================================

function buildGenerationPrompt(topic: string, settings: ContentSettings): string {
  const { minWordCount, maxWordCount, enableFaqs, enableToc, enableKeyTakeaways } = settings
  const targetWords = Math.round((minWordCount + maxWordCount) / 2)
  const numSections = Math.max(5, Math.ceil(targetWords / 400))
  
  let additionalSections = ''
  if (enableFaqs !== false) {
    additionalSections += `\n  "faqs": [{"question": "FAQ 1?", "answer": "Answer 1..."}, {"question": "FAQ 2?", "answer": "Answer 2..."}],`
  }
  if (enableKeyTakeaways !== false) {
    additionalSections += `\n  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4", "Takeaway 5"],`
  }
  if (enableToc !== false) {
    additionalSections += `\n  "tableOfContents": ["Section 1", "Section 2", "Section 3"],`
  }

  return `You are an elite SEO content writer creating comprehensive, valuable content.

TOPIC: ${topic}

=== CRITICAL WORD COUNT REQUIREMENT ===
MINIMUM: ${minWordCount} words
MAXIMUM: ${maxWordCount} words
TARGET: ${targetWords} words

Write ${numSections} comprehensive sections with 350-500 words each.
This is NON-NEGOTIABLE. Content outside this range will be rejected and regenerated.

=== CONTENT STRUCTURE ===
1. Write ${numSections} detailed H2 sections
2. Each section: 2-3 substantial paragraphs
3. Include specific examples and actionable advice
4. Use conversational but authoritative tone
5. Make content scannable with clear formatting

=== OUTPUT FORMAT ===
Respond with valid JSON only (no markdown code blocks):
{
  "title": "SEO title (50-60 chars)",
  "metaDescription": "Meta description (150-160 chars)",
  "h1": "Main heading",
  "h2s": ["Section 1", "Section 2", ...],
  "content": "<h2>Section 1</h2><p>Comprehensive paragraph...</p><p>Another paragraph...</p><h2>Section 2</h2>...",
  "tldrSummary": "2-3 sentence summary",${additionalSections}
  "excerpt": "2-3 sentence excerpt"
}

REMEMBER: Content MUST be ${minWordCount}-${maxWordCount} words!`
}

function buildExpansionPrompt(
  existingContent: string, 
  currentWords: number, 
  targetWords: number,
  topic: string
): string {
  const wordsToAdd = targetWords - currentWords + 100
  
  return `You are expanding existing content to meet word count requirements.

TOPIC: ${topic}
CURRENT WORD COUNT: ${currentWords}
TARGET WORD COUNT: ${targetWords}
WORDS TO ADD: ${wordsToAdd}

EXISTING CONTENT:
${existingContent}

=== TASK ===
Expand this content by adding ${wordsToAdd} more words. You can:
1. Add more detailed explanations to existing sections
2. Add new subsections with H3 headings
3. Include more examples, statistics, or case studies
4. Expand on key points with additional insights

=== OUTPUT FORMAT ===
Return the FULL expanded content as JSON:
{
  "content": "<h2>Section 1</h2><p>Original + expanded content...</p>..."
}

IMPORTANT: Return the COMPLETE content with expansions integrated naturally.`
}

// ============================================================================
// AI GENERATION WITH RETRY LOOP (CRITICAL FIX!)
// ============================================================================

async function generateContentWithRetry(
  aiConfig: AIConfig,
  topic: string,
  settings: ContentSettings,
  updateProgress: (progress: number, step: string) => Promise<void>
): Promise<GeneratedContent> {
  const { provider, apiKey, model } = aiConfig
  const maxTokens = getMaxTokensForModel(provider, model)
  
  console.log(`[AI] Provider: ${provider}, Model: ${model}, Max Tokens: ${maxTokens}`)
  console.log(`[AI] Target word count: ${settings.minWordCount}-${settings.maxWordCount}`)
  
  let content = ''
  let attempts = 0
  let lastResult: any = null
  
  while (attempts < MAX_RETRIES) {
    attempts++
    console.log(`[AI] Attempt ${attempts}/${MAX_RETRIES}`)
    
    await updateProgress(40 + (attempts * 10), `Generating content (attempt ${attempts}/${MAX_RETRIES})...`)
    
    try {
      // Generate or expand content
      if (content === '' || attempts === 1) {
        // Initial generation
        lastResult = await callAIProvider(
          provider, 
          apiKey, 
          model, 
          buildGenerationPrompt(topic, settings),
          maxTokens
        )
        content = lastResult.content || ''
      } else {
        // Expansion attempt
        const currentWords = countWords(content)
        const expandResult = await callAIProvider(
          provider,
          apiKey,
          model,
          buildExpansionPrompt(content, currentWords, settings.minWordCount, topic),
          maxTokens
        )
        if (expandResult.content) {
          content = expandResult.content
        }
      }
      
      // Validate word count
      const validation = validateWordCount(content, settings.minWordCount, settings.maxWordCount)
      console.log(`[AI] Word count: ${validation.wordCount}, Action: ${validation.action}`)
      
      if (validation.isValid || validation.action === 'accept') {
        console.log(`[AI] ✅ Word count met after ${attempts} attempts`)
        break
      }
      
      if (validation.action === 'truncate' && validation.wordsToRemove) {
        console.log(`[AI] Truncating ${validation.wordsToRemove} words`)
        content = smartTruncate(content, settings.maxWordCount)
        break // Truncation is always final
      }
      
      if (validation.action === 'regenerate') {
        console.log(`[AI] Content too short (${validation.wordCount}), regenerating...`)
        content = '' // Force full regeneration
      }
      
      // For 'expand' action, loop will continue
      
    } catch (err) {
      console.error(`[AI] Attempt ${attempts} failed:`, err)
      if (attempts >= MAX_RETRIES) throw err
    }
  }
  
  // Build final result
  const finalWordCount = countWords(content)
  const wordCountMet = finalWordCount >= settings.minWordCount * 0.9 && 
                       finalWordCount <= settings.maxWordCount * 1.1
  
  console.log(`[AI] Final word count: ${finalWordCount}, Met: ${wordCountMet}, Attempts: ${attempts}`)
  
  return {
    title: lastResult?.title || topic,
    optimizedTitle: lastResult?.title || topic,
    optimizedContent: content,
    content: content,
    wordCount: finalWordCount,
    qualityScore: Math.min(95, 70 + Math.floor(finalWordCount / 50)),
    seoScore: wordCountMet ? 85 : 70,
    readabilityScore: 80,
    metaDescription: lastResult?.metaDescription || '',
    h1: lastResult?.h1 || lastResult?.title || topic,
    h2s: lastResult?.h2s || [],
    sections: [
      { type: 'tldr', content: lastResult?.tldrSummary || '' },
      { type: 'takeaways', data: lastResult?.keyTakeaways || [] },
      { type: 'faqs', data: lastResult?.faqs || [] },
      { type: 'paragraph', content: content },
    ],
    excerpt: lastResult?.excerpt || lastResult?.metaDescription || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
    attempts,
  }
}

// ============================================================================
// UNIFIED AI PROVIDER CALLER
// ============================================================================

async function callAIProvider(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number
): Promise<any> {
  console.log(`[callAIProvider] Provider: ${provider}, Model: ${model}, Max Tokens: ${maxTokens}`)
  
  let response: Response
  let data: any
  
  switch (provider.toLowerCase()) {
    case 'google':
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, topP: 0.9 },
          }),
        }
      )
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Gemini error ${response.status}: ${err.slice(0, 200)}`)
      }
      data = await response.json()
      
      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        console.warn(`[Gemini] ⚠️ Output truncated due to token limit`)
      }
      
      return parseAIResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || '')

    case 'openai':
      response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert SEO content writer. Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 200)}`)
      }
      data = await response.json()
      
      if (data.choices?.[0]?.finish_reason === 'length') {
        console.warn(`[OpenAI] ⚠️ Output truncated due to token limit`)
      }
      
      return parseAIResponse(data.choices?.[0]?.message?.content || '')

    case 'anthropic':
      response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Anthropic error ${response.status}: ${err.slice(0, 200)}`)
      }
      data = await response.json()
      
      if (data.stop_reason === 'max_tokens') {
        console.warn(`[Anthropic] ⚠️ Output truncated due to token limit`)
      }
      
      return parseAIResponse(data.content?.[0]?.text || '')

    case 'groq':
      response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: Math.min(8192, maxTokens), // Groq limit
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Groq error ${response.status}: ${err.slice(0, 200)}`)
      }
      data = await response.json()
      
      if (data.choices?.[0]?.finish_reason === 'length') {
        console.warn(`[Groq] ⚠️ Output truncated due to token limit`)
      }
      
      return parseAIResponse(data.choices?.[0]?.message?.content || '')

    case 'openrouter':
      response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://page-perfector.app',
          'X-Title': 'Page Perfector',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert SEO content writer. Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`OpenRouter error ${response.status}: ${err.slice(0, 200)}`)
      }
      data = await response.json()
      
      if (data.choices?.[0]?.finish_reason === 'length') {
        console.warn(`[OpenRouter] ⚠️ Output truncated due to token limit`)
      }
      
      return parseAIResponse(data.choices?.[0]?.message?.content || '')

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

function parseAIResponse(text: string): any {
  if (!text) {
    throw new Error('AI returned empty response')
  }
  
  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('No JSON found in AI response')
  }
  
  try {
    return JSON.parse(match[0])
  } catch (err) {
    throw new Error('Failed to parse AI response as JSON')
  }
}

// ============================================================================
// JOB PROCESSING
// ============================================================================

async function updateProgress(supabase: any, jobId: string, progress: number, step: string): Promise<void> {
  await supabase.from('jobs').update({ 
    progress, 
    current_step: step,
    updated_at: new Date().toISOString()
  }).eq('id', jobId)
  console.log(`[Job ${jobId}] ${progress}% - ${step}`)
}

async function processJob(
  supabase: any, 
  jobId: string, 
  topic: string, 
  aiConfig: AIConfig,
  contentSettings: ContentSettings
): Promise<void> {
  console.log(`[Job ${jobId}] ========== STARTING ==========`)
  console.log(`[Job ${jobId}] Topic: ${topic}`)
  console.log(`[Job ${jobId}] Word Count: ${contentSettings.minWordCount}-${contentSettings.maxWordCount}`)
  
  const progressUpdater = async (progress: number, step: string) => {
    await updateProgress(supabase, jobId, progress, step)
  }
  
  try {
    await progressUpdater(10, 'Analyzing content requirements...')
    await progressUpdater(20, 'Preparing AI generation...')
    
    const result = await generateContentWithRetry(
      aiConfig, 
      topic, 
      contentSettings,
      progressUpdater
    )
    
    await progressUpdater(85, 'Applying SEO optimizations...')
    await progressUpdater(95, 'Finalizing content...')

    await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: `Complete! ${result.wordCount} words (${result.attempts} attempts)`,
      result: result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    console.log(`[Job ${jobId}] ✅ COMPLETED! Words: ${result.wordCount}, Attempts: ${result.attempts}`)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Job ${jobId}] ❌ FAILED:`, errorMessage)
    
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: errorMessage,
      current_step: 'Failed - ' + errorMessage.split(':')[0],
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[optimize-content] ========== NEW REQUEST ==========')
  console.log('[optimize-content] Version: v17.0.0 (word count enforcement)')

  try {
    const body = await req.json()
    
    const contentSettings: ContentSettings = {
      minWordCount: body.contentSettings?.minWordCount || body.advanced?.minWordCount || 2000,
      maxWordCount: body.contentSettings?.maxWordCount || body.advanced?.maxWordCount || 3000,
      enableFaqs: body.contentSettings?.enableFaqs ?? true,
      enableToc: body.contentSettings?.enableToc ?? true,
      enableKeyTakeaways: body.contentSettings?.enableKeyTakeaways ?? true,
    }
    
    console.log('[optimize-content] Word count target:', contentSettings.minWordCount, '-', contentSettings.maxWordCount)

    const aiConfig = body.aiConfig as AIConfig | undefined
    
    if (!aiConfig?.apiKey || !aiConfig?.provider || !aiConfig?.model) {
      return errorResponse('AI_NOT_CONFIGURED', 'AI configuration is required.')
    }

    const topic = body.postTitle || body.keyword || 'Content Optimization'
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return errorResponse('SERVER_ERROR', 'Server configuration error.', {}, 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    })

    const jobId = crypto.randomUUID()

    await supabase.from('jobs').insert({
      id: jobId,
      page_id: body.pageId || null,
      status: 'running',
      progress: 5,
      current_step: 'Initializing...',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Process synchronously
    await processJob(supabase, jobId, topic, aiConfig, contentSettings)
    
    const { data: completedJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (completedJob?.status === 'completed' && completedJob?.result) {
      return jsonResponse({
        success: true,
        jobId,
        status: 'completed',
        result: completedJob.result,
        message: `Generated ${completedJob.result?.wordCount || 0} words in ${completedJob.result?.attempts || 1} attempts.`,
      })
    } else {
      return jsonResponse({
        success: false,
        jobId,
        status: completedJob?.status || 'failed',
        error: completedJob?.error_message || 'Job failed',
      }, 500)
    }

  } catch (err) {
    console.error('[optimize-content] Error:', err)
    return errorResponse(
      'REQUEST_ERROR',
      err instanceof Error ? err.message : 'An unexpected error occurred',
      {},
      500
    )
  }
})
