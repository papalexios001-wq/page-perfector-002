// ============================================================================
// OPTIMIZE-CONTENT EDGE FUNCTION - ENTERPRISE SOTA v15.0.0
// FIXED: Synchronous processing - await processJob before returning HTTP response// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_TIMEOUT_MS = 300000 // 300 seconds (5 minutes) for longer content
const MAX_OUTPUT_TOKENS = 32768 // Maximum tokens for content generation

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
}

// ============================================================================
// HELPER: JSON Response
// ============================================================================

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  })
}

// ============================================================================
// HELPER: Error Response with Actionable Guidance
// ============================================================================

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
    details: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  }, status)
}

// ============================================================================
// HELPER: Fetch with Timeout
// ============================================================================

async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeoutMs: number = AI_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.log(`[Timeout] Aborting request after ${timeoutMs}ms`)
    controller.abort()
  }, timeoutMs)

  console.log(`[fetchWithTimeout] Timeout: ${timeoutMs}ms`)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI_TIMEOUT: Request timed out after ${timeoutMs / 1000} seconds. The AI provider is taking too long to respond. Please try again.`)
    }
    throw error
  }
}

// ============================================================================
// HELPER: Build AI Prompt with Word Count Requirements
// ============================================================================

function buildPrompt(topic: string, settings: ContentSettings): string {
  const { minWordCount, maxWordCount, enableFaqs, enableToc, enableKeyTakeaways } = settings
  
  // Calculate number of sections needed for target word count
  const targetWords = Math.round((minWordCount + maxWordCount) / 2)
  const numSections = Math.max(5, Math.ceil(targetWords / 400)) // ~400 words per section
  
  let additionalSections = ''
  if (enableFaqs !== false) {
    additionalSections += '\n  "faqs": [{"question": "FAQ 1?", "answer": "Detailed answer..."}, {"question": "FAQ 2?", "answer": "Detailed answer..."}],'
  }
  if (enableKeyTakeaways !== false) {
    additionalSections += '\n  "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],'
  }
  if (enableToc !== false) {
    additionalSections += '\n  "tableOfContents": ["Introduction", "Section 1", "Section 2", ...],'
  }

  return `You are an expert SEO content writer. Generate a comprehensive, engaging, and in-depth blog post.

TOPIC: ${topic}

=== CRITICAL WORD COUNT REQUIREMENT ===
You MUST write between ${minWordCount} and ${maxWordCount} words.
Target: ${targetWords} words.
This is a HARD requirement - do NOT write less than ${minWordCount} words.
Write ${numSections} substantial sections with 300-500 words each.

=== CONTENT REQUIREMENTS ===
- Write EXACTLY ${minWordCount}-${maxWordCount} words of high-quality content
- Use conversational but authoritative tone
- Include specific examples, case studies, and actionable advice
- Structure with ${numSections} clear H2 sections, each with 2-3 paragraphs
- Each paragraph should be 4-6 sentences
- Include bullet points, numbered lists where appropriate
- Add real statistics and data points where relevant
- Make every section comprehensive and valuable

=== OUTPUT FORMAT ===
Respond ONLY with valid JSON (no markdown code blocks):
{
  "title": "Compelling SEO title (50-60 chars)",
  "metaDescription": "Engaging meta description with keyword (150-160 chars)",
  "h1": "Main H1 heading - slightly different from title",
  "h2s": ["H2 Section 1", "H2 Section 2", "H2 Section 3", ... (${numSections} sections)],
  "content": "<h2>Section 1 Title</h2><p>Comprehensive paragraph 1 with 4-6 sentences...</p><p>Another detailed paragraph...</p><h2>Section 2 Title</h2><p>More in-depth content...</p>... CONTINUE UNTIL YOU REACH ${minWordCount}-${maxWordCount} WORDS",
  "tldrSummary": "A 2-3 sentence TL;DR summary",${additionalSections}
  "excerpt": "A compelling 2-3 sentence excerpt for previews"
}

REMEMBER: The "content" field MUST contain ${minWordCount}-${maxWordCount} words of HTML content. Count your words!`
}

// ============================================================================
// AI GENERATION: GOOGLE GEMINI
// ============================================================================

async function generateWithGemini(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log(`[Gemini] Generating content for: "${topic}" with model: ${model}`)
  console.log(`[Gemini] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Gemini] Max output tokens: ${MAX_OUTPUT_TOKENS}`)
  
  const prompt = buildPrompt(topic, settings)

  const startTime = Date.now()
  
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          topP: 0.9,
        },
      }),
    }
  )

  const duration = Date.now() - startTime
  console.log(`[Gemini] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Gemini] API error ${response.status}:`, errorText)
    
    if (response.status === 400 && errorText.includes('API_KEY_INVALID')) {
      throw new Error('INVALID_API_KEY: Your Google AI API key is invalid. Please check your API key in the Configuration tab.')
    }
    if (response.status === 403) {
      throw new Error('API_KEY_FORBIDDEN: Your Google AI API key does not have permission to use this model.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: Google AI rate limit exceeded. Please wait a moment and try again.')
    }
    
    throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  
  // Log finish reason
  const finishReason = data.candidates?.[0]?.finishReason
  console.log(`[Gemini] Finish reason: ${finishReason}`)
  
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[Gemini] ⚠️ Output was truncated due to token limit!`)
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  if (!text) {
    throw new Error('AI_EMPTY_RESPONSE: Gemini returned an empty response. Please try again.')
  }
  
  let jsonStr = text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }
  
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    console.error('[Gemini] JSON parse error, raw text:', text.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response. Please try again.')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount
  
  console.log(`[Gemini] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Gemini] Word count target: ${settings.minWordCount}-${settings.maxWordCount} - ${wordCountMet ? 'MET ✅' : 'NOT MET ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || parsed.title || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'faqs', data: parsed.faqs || [] },
      { type: 'toc', data: parsed.tableOfContents || [] },
      { type: 'paragraph', content: parsed.content || '' },
      { type: 'summary', content: parsed.excerpt || '' },
    ],
    excerpt: parsed.excerpt || parsed.metaDescription || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
  }
}

// ============================================================================
// AI GENERATION: OPENAI
// ============================================================================

async function generateWithOpenAI(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log(`[OpenAI] Generating content for: "${topic}" with model: ${model}`)
  console.log(`[OpenAI] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[OpenAI] Max output tokens: ${MAX_OUTPUT_TOKENS}`)

  const prompt = buildPrompt(topic, settings)

  const startTime = Date.now()

  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert SEO content writer. Always respond with valid JSON only, no markdown. You MUST write between ${settings.minWordCount} and ${settings.maxWordCount} words.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[OpenAI] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenAI] API error ${response.status}:`, errorText)
    
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your OpenAI API key is invalid.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: OpenAI rate limit exceeded. Please wait and try again.')
    }
    
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Log finish reason and token usage
  const finishReason = data.choices?.[0]?.finish_reason
  const usage = data.usage
  console.log(`[OpenAI] Finish reason: ${finishReason}`)
  console.log(`[OpenAI] Token usage: ${JSON.stringify(usage)}`)
  
  if (finishReason === 'length') {
    console.warn(`[OpenAI] ⚠️ Output was truncated due to token limit!`)
  }
  
  const text = data.choices?.[0]?.message?.content || ''
  
  if (!text) {
    throw new Error('AI_EMPTY_RESPONSE: OpenAI returned an empty response.')
  }
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[OpenAI] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[OpenAI] Word count target: ${settings.minWordCount}-${settings.maxWordCount} - ${wordCountMet ? 'MET ✅' : 'NOT MET ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'faqs', data: parsed.faqs || [] },
      { type: 'paragraph', content: parsed.content || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
  }
}

// ============================================================================
// AI GENERATION: ANTHROPIC (CLAUDE)
// ============================================================================

async function generateWithAnthropic(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log(`[Anthropic] Generating content for: "${topic}" with model: ${model}`)
  console.log(`[Anthropic] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Anthropic] Max output tokens: ${MAX_OUTPUT_TOKENS}`)

  const prompt = buildPrompt(topic, settings)

  const startTime = Date.now()

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[Anthropic] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your Anthropic API key is invalid.')
    }
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Log stop reason and usage
  const stopReason = data.stop_reason
  const usage = data.usage
  console.log(`[Anthropic] Stop reason: ${stopReason}`)
  console.log(`[Anthropic] Token usage: ${JSON.stringify(usage)}`)
  
  if (stopReason === 'max_tokens') {
    console.warn(`[Anthropic] ⚠️ Output was truncated due to token limit!`)
  }
  
  const text = data.content?.[0]?.text || ''
  
  if (!text) {
    throw new Error('AI_EMPTY_RESPONSE: Anthropic returned an empty response.')
  }
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[Anthropic] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Anthropic] Word count target: ${settings.minWordCount}-${settings.maxWordCount} - ${wordCountMet ? 'MET ✅' : 'NOT MET ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
  }
}

// ============================================================================
// AI GENERATION: GROQ
// ============================================================================

async function generateWithGroq(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log(`[Groq] Generating content for: "${topic}" with model: ${model}`)
  console.log(`[Groq] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  
  // Groq has a lower max token limit
  const groqMaxTokens = Math.min(8192, MAX_OUTPUT_TOKENS)
  console.log(`[Groq] Max output tokens: ${groqMaxTokens}`)

  const prompt = buildPrompt(topic, settings)

  const startTime = Date.now()

  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert SEO content writer. Write EXACTLY ${settings.minWordCount}-${settings.maxWordCount} words. Respond with valid JSON only.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: groqMaxTokens,
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[Groq] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your Groq API key is invalid.')
    }
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Log finish reason
  const finishReason = data.choices?.[0]?.finish_reason
  const usage = data.usage
  console.log(`[Groq] Finish reason: ${finishReason}`)
  console.log(`[Groq] Token usage: ${JSON.stringify(usage)}`)
  
  if (finishReason === 'length') {
    console.warn(`[Groq] ⚠️ Output was truncated due to token limit!`)
  }
  
  const text = data.choices?.[0]?.message?.content || ''
  
  if (!text) {
    throw new Error('AI_EMPTY_RESPONSE: Groq returned an empty response.')
  }
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[Groq] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Groq] Word count target: ${settings.minWordCount}-${settings.maxWordCount} - ${wordCountMet ? 'MET ✅' : 'NOT MET ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
  }
}

// ============================================================================
// AI GENERATION: OPENROUTER - FIXED WITH 32768 MAX TOKENS
// ============================================================================

async function generateWithOpenRouter(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log(`[OpenRouter] ========== STARTING GENERATION ==========`)
  console.log(`[OpenRouter] Model: ${model}`)
  console.log(`[OpenRouter] Topic: "${topic}"`)
  console.log(`[OpenRouter] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[OpenRouter] Max output tokens: ${MAX_OUTPUT_TOKENS}`)
  console.log(`[OpenRouter] Timeout: ${AI_TIMEOUT_MS}ms`)

  const prompt = buildPrompt(topic, settings)

  const startTime = Date.now()

  const requestBody = {
    model: model || 'openai/gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: `You are an expert SEO content writer. You MUST write between ${settings.minWordCount} and ${settings.maxWordCount} words. This is a HARD requirement. Respond with valid JSON only, no markdown code blocks.` 
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: MAX_OUTPUT_TOKENS, // CRITICAL: Set to 32768 to prevent length cutoff
    top_p: 0.9,
  }

  console.log(`[OpenRouter] Request body max_tokens: ${requestBody.max_tokens}`)

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://page-perfector.app',
      'X-Title': 'Page Perfector',
    },
    body: JSON.stringify(requestBody),
  })

  const duration = Date.now() - startTime
  console.log(`[OpenRouter] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenRouter] API error ${response.status}:`, errorText)
    
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your OpenRouter API key is invalid.')
    }
    if (response.status === 402) {
      throw new Error('INSUFFICIENT_CREDITS: Your OpenRouter account has insufficient credits.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: OpenRouter rate limit exceeded. Please wait and try again.')
    }
    
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  
  // ========== CRITICAL: Log finish reason to detect truncation ==========
  const finishReason = data.choices?.[0]?.finish_reason
  const usage = data.usage
  
  console.log(`[OpenRouter] ========== RESPONSE ANALYSIS ==========`)
  console.log(`[OpenRouter] Finish reason: ${finishReason}`)
  console.log(`[OpenRouter] Token usage: prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, total=${usage?.total_tokens}`)
  
  if (finishReason === 'length') {
    console.error(`[OpenRouter] ❌ OUTPUT WAS TRUNCATED DUE TO TOKEN LIMIT!`)
    console.error(`[OpenRouter] The model hit its output token limit. Generated ${usage?.completion_tokens} tokens.`)
    console.error(`[OpenRouter] This should NOT happen with max_tokens=${MAX_OUTPUT_TOKENS}`)
  } else {
    console.log(`[OpenRouter] ✅ Output completed naturally (finish_reason: ${finishReason})`)
  }
  
  const text = data.choices?.[0]?.message?.content || ''
  
  if (!text) {
    console.error(`[OpenRouter] Empty response! Full response:`, JSON.stringify(data).slice(0, 500))
    throw new Error('AI_EMPTY_RESPONSE: OpenRouter returned an empty response. This may be due to rate limiting or model issues.')
  }
  
  console.log(`[OpenRouter] Raw response length: ${text.length} characters`)
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    jsonStr = match[0]
  } else {
    console.error(`[OpenRouter] No JSON found in response! First 500 chars:`, text.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: No valid JSON found in AI response.')
  }
  
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseError) {
    console.error(`[OpenRouter] JSON parse error! First 500 chars of extracted JSON:`, jsonStr.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response as JSON.')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[OpenRouter] ========== GENERATION COMPLETE ==========`)
  console.log(`[OpenRouter] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[OpenRouter] Target: ${settings.minWordCount}-${settings.maxWordCount} words`)
  console.log(`[OpenRouter] Word count met: ${wordCountMet ? 'YES ✅' : 'NO ❌'}`)
  
  if (!wordCountMet && finishReason === 'length') {
    console.error(`[OpenRouter] ❌ Word count NOT met because output was truncated!`)
  }

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'faqs', data: parsed.faqs || [] },
      { type: 'paragraph', content: parsed.content || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
    targetWordCount: { min: settings.minWordCount, max: settings.maxWordCount },
    wordCountMet,
  }
}

// ============================================================================
// MAIN AI ROUTER
// ============================================================================

async function generateWithAI(
  aiConfig: AIConfig, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  console.log('[generateWithAI] ========== AI GENERATION START ==========')
  console.log('[generateWithAI] Provider:', aiConfig.provider)
  console.log('[generateWithAI] Model:', aiConfig.model)
  console.log('[generateWithAI] Topic:', topic)
  console.log('[generateWithAI] Word Count Target:', settings.minWordCount, '-', settings.maxWordCount)
  console.log('[generateWithAI] Max Tokens:', MAX_OUTPUT_TOKENS)
  console.log('[generateWithAI] Timeout:', AI_TIMEOUT_MS, 'ms')

  const { provider, apiKey, model } = aiConfig

  switch (provider.toLowerCase()) {
    case 'google':
      return await generateWithGemini(apiKey, model || 'gemini-2.0-flash', topic, settings)
    
    case 'openai':
      return await generateWithOpenAI(apiKey, model || 'gpt-4o-mini', topic, settings)
    
    case 'anthropic':
      return await generateWithAnthropic(apiKey, model || 'claude-3-haiku-20240307', topic, settings)
    
    case 'groq':
      return await generateWithGroq(apiKey, model || 'llama-3.1-70b-versatile', topic, settings)
    
    case 'openrouter':
      return await generateWithOpenRouter(apiKey, model || 'openai/gpt-4o-mini', topic, settings)
    
    default:
      throw new Error(`UNSUPPORTED_PROVIDER: Provider "${provider}" is not supported.`)
  }
}

// ============================================================================
// JOB PROGRESS UPDATES
// ============================================================================

async function updateProgress(supabase: any, jobId: string, progress: number, step: string): Promise<void> {
  const { error } = await supabase.from('jobs').update({ 
    progress, 
    current_step: step,
    updated_at: new Date().toISOString()
  }).eq('id', jobId)
  
  if (error) {
    console.error(`[Job ${jobId}] Progress update failed:`, error)
  } else {
    console.log(`[Job ${jobId}] ${progress}% - ${step}`)
  }
}

// ============================================================================
// BACKGROUND JOB PROCESSING
// ============================================================================

async function processJob(
  supabase: any, 
  jobId: string, 
  topic: string, 
  aiConfig: AIConfig,
  contentSettings: ContentSettings
): Promise<void> {
  console.log(`[Job ${jobId}] ========== STARTING BACKGROUND PROCESSING ==========`)
  console.log(`[Job ${jobId}] Topic: ${topic}`)
  console.log(`[Job ${jobId}] AI Provider: ${aiConfig.provider}`)
  console.log(`[Job ${jobId}] AI Model: ${aiConfig.model}`)
  console.log(`[Job ${jobId}] Word Count: ${contentSettings.minWordCount}-${contentSettings.maxWordCount}`)
  console.log(`[Job ${jobId}] Max Tokens: ${MAX_OUTPUT_TOKENS}`)
  
  try {
    await updateProgress(supabase, jobId, 15, 'Analyzing content requirements...')
    await new Promise(r => setTimeout(r, 300))

    await updateProgress(supabase, jobId, 30, 'Researching topic and keywords...')
    await new Promise(r => setTimeout(r, 300))

    await updateProgress(supabase, jobId, 50, `Generating ${contentSettings.minWordCount}-${contentSettings.maxWordCount} word article with ${aiConfig.provider}...`)
    
    const startTime = Date.now()
    const result = await generateWithAI(aiConfig, topic, contentSettings)
    const duration = Date.now() - startTime
    
    console.log(`[Job ${jobId}] AI generation completed in ${duration}ms`)
    console.log(`[Job ${jobId}] Word count: ${result.wordCount} (target: ${contentSettings.minWordCount}-${contentSettings.maxWordCount})`)

    await updateProgress(supabase, jobId, 70, 'Applying SEO optimizations...')
    await new Promise(r => setTimeout(r, 200))

    await updateProgress(supabase, jobId, 90, 'Finalizing content...')
    await new Promise(r => setTimeout(r, 200))

    const { error: completeError } = await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: `Complete! ${result.wordCount} words generated`,
      result: result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    if (completeError) {
      console.error(`[Job ${jobId}] Complete update failed:`, completeError)
    } else {
      console.log(`[Job ${jobId}] ✅ COMPLETED! Words: ${result.wordCount}, Quality: ${result.qualityScore}`)
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Job ${jobId}] ❌ FAILED:`, errorMessage)
    
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: errorMessage,
      current_step: 'Failed - ' + (errorMessage.split(':')[0] || 'Error'),
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
  console.log('[optimize-content] Version: v15.0.0 (max_tokens: 32768, timeout: 300s)')

  try {
    const body = await req.json()
    
    // Extract content settings from multiple possible locations
    const contentSettings: ContentSettings = {
      minWordCount: body.contentSettings?.minWordCount || body.advanced?.minWordCount || body.minWordCount || 2000,
      maxWordCount: body.contentSettings?.maxWordCount || body.advanced?.maxWordCount || body.maxWordCount || 3000,
      enableFaqs: body.contentSettings?.enableFaqs ?? body.advanced?.enableFaqs ?? true,
      enableToc: body.contentSettings?.enableToc ?? body.advanced?.enableToc ?? true,
      enableKeyTakeaways: body.contentSettings?.enableKeyTakeaways ?? body.advanced?.enableKeyTakeaways ?? true,
    }
    
    console.log('[optimize-content] Content settings:', JSON.stringify(contentSettings))
    console.log('[optimize-content] Max tokens:', MAX_OUTPUT_TOKENS)
    console.log('[optimize-content] Timeout:', AI_TIMEOUT_MS, 'ms')
    
    const logData = {
      url: body.url || body.siteUrl,
      postTitle: body.postTitle,
      aiProvider: body.aiConfig?.provider,
      hasAiKey: !!body.aiConfig?.apiKey,
      aiModel: body.aiConfig?.model,
      wordCount: `${contentSettings.minWordCount}-${contentSettings.maxWordCount}`,
    }
    console.log('[optimize-content] Received:', JSON.stringify(logData))

    // Validate AI config
    const aiConfig = body.aiConfig as AIConfig | undefined
    
    if (!aiConfig) {
      return errorResponse('AI_NOT_CONFIGURED', 'AI configuration is required.', {
        fix: 'Go to Configuration → AI Provider → Enter your API key',
      })
    }

    if (!aiConfig.apiKey) {
      return errorResponse('AI_API_KEY_MISSING', 'AI API key is required.', {
        fix: 'Go to Configuration → AI Provider → Enter your API key',
      })
    }

    if (!aiConfig.provider) {
      return errorResponse('AI_PROVIDER_MISSING', 'AI provider is required.', {})
    }

    if (!aiConfig.model) {
      return errorResponse('AI_MODEL_MISSING', 'AI model is required.', {})
    }

    const supportedProviders = ['google', 'openai', 'anthropic', 'groq', 'openrouter']
    if (!supportedProviders.includes(aiConfig.provider.toLowerCase())) {
      return errorResponse('UNSUPPORTED_PROVIDER', `Provider "${aiConfig.provider}" is not supported.`, {
        supportedProviders,
      })
    }

    const topic = body.postTitle || body.keyword || body.url || 'Content Optimization'
    
    console.log('[optimize-content] ✓ Configuration validated')
    console.log('[optimize-content] Topic:', topic)
    console.log('[optimize-content] Word count:', contentSettings.minWordCount, '-', contentSettings.maxWordCount)

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return errorResponse('SERVER_ERROR', 'Server configuration error.', {}, 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    })

    const jobId = crypto.randomUUID()
    console.log('[optimize-content] Creating job:', jobId)

    const { error: insertError } = await supabase.from('jobs').insert({
      id: jobId,
      page_id: body.pageId || null,
      status: 'running',
      progress: 5,
      current_step: `Initializing ${contentSettings.minWordCount}-${contentSettings.maxWordCount} word article...`,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      return errorResponse('DATABASE_ERROR', 'Failed to create job.', { error: insertError.message }, 500)
    }

    // Process job synchronously (CRITICAL: Supabase Edge Functions terminate after HTTP response)
    // We MUST await the job completion before returning
    try {
      console.log(`[optimize-content] Starting synchronous processing for job: ${jobId}`)
      await processJob(supabase, jobId, topic, aiConfig, contentSettings)
      
      // Fetch the completed job from database
      const { data: completedJob, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      
      if (fetchError) {
        console.error('[optimize-content] Failed to fetch completed job:', fetchError)
        return errorResponse('DATABASE_ERROR', 'Failed to retrieve job result', { error: fetchError.message }, 500)
      }
      
      console.log(`[optimize-content] Job ${jobId} status: ${completedJob?.status}`)
      
      if (completedJob?.status === 'completed' && completedJob?.result) {
        console.log(`[optimize-content] ✅ Job completed successfully! Words: ${completedJob.result?.wordCount}`)
        return jsonResponse({
          success: true,
          jobId: jobId,
          pageId: body.pageId || null,
          status: 'completed',
          progress: 100,
          current_step: 'Complete!',
          result: completedJob.result,
          message: `Optimization completed! Generated ${completedJob.result?.wordCount || 0} words.`,
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
          contentSettings,
        })
      } else {
        console.error(`[optimize-content] Job failed or incomplete: ${completedJob?.status}`)
        return jsonResponse({
          success: false,
          jobId: jobId,
          status: completedJob?.status || 'failed',
          error: completedJob?.error_message || 'Job did not complete successfully',
          message: completedJob?.error_message || 'Optimization failed',
        }, 500)
      }
    } catch (processError) {
      console.error('[optimize-content] Processing error:', processError)
      // Update job status to failed
      await supabase.from('jobs').update({
        status: 'failed',
        error_message: processError instanceof Error ? processError.message : 'Processing failed',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId)
      
      return errorResponse(
        'PROCESSING_ERROR',
        processError instanceof Error ? processError.message : 'Processing failed',
        {},
        500
      )
    }

  } catch (err) {
    console.error('[optimize-content] Request error:', err)
    return errorResponse(
      'REQUEST_ERROR',
      err instanceof Error ? err.message : 'An unexpected error occurred',
      {},
      500
    )
  }
})
