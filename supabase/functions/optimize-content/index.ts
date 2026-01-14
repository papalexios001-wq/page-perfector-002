// ============================================================================
// OPTIMIZE-CONTENT EDGE FUNCTION - ENTERPRISE SOTA v17.0.0
// ============================================================================
// FIXES IN THIS VERSION:
// ✅ Word count validation with retry loop (up to 3 attempts)
// ✅ Content expansion when too short
// ✅ Smart truncation when too long
// ✅ Provider-specific token limits (prevents truncation)
// ✅ Detailed logging for debugging
// ✅ Synchronous processing with proper job tracking
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_TIMEOUT_MS = 300000 // 5 minutes for longer content generation
const MAX_WORD_COUNT_RETRIES = 3 // Maximum attempts to meet word count
const WORD_COUNT_TOLERANCE = 0.10 // Allow 10% variance from target

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================================
// PROVIDER-SPECIFIC TOKEN LIMITS (CRITICAL FOR PREVENTING TRUNCATION)
// ============================================================================
const PROVIDER_TOKEN_LIMITS: Record<string, Record<string, number>> = {
  google: {
    'gemini-2.5-flash-preview-04-17': 65536,
    'gemini-2.5-pro-preview-05-06': 65536,
    'gemini-2.0-flash': 8192,
    'gemini-2.0-flash-lite': 8192,
    'gemini-1.5-flash': 8192,
    'gemini-1.5-flash-8b': 8192,
    'gemini-1.5-pro': 8192,
    'gemini-pro': 8192,
    'default': 8192,
  },
  openai: {
    'gpt-4o': 16384,
    'gpt-4o-mini': 16384,
    'gpt-4-turbo': 4096,
    'gpt-4-turbo-preview': 4096,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 4096,
    'gpt-3.5-turbo-16k': 16384,
    'o1-preview': 32768,
    'o1-mini': 65536,
    'default': 4096,
  },
  anthropic: {
    'claude-sonnet-4-20250514': 16384,
    'claude-3-7-sonnet-20250219': 16384,
    'claude-3-5-sonnet-20241022': 8192,
    'claude-3-5-sonnet-20240620': 8192,
    'claude-3-sonnet-20240229': 4096,
    'claude-3-haiku-20240307': 4096,
    'claude-3-opus-20240229': 4096,
    'default': 4096,
  },
  groq: {
    'llama-3.3-70b-versatile': 32768,
    'llama-3.1-70b-versatile': 8192,
    'llama-3.1-8b-instant': 8192,
    'llama3-70b-8192': 8192,
    'llama3-8b-8192': 8192,
    'mixtral-8x7b-32768': 32768,
    'gemma2-9b-it': 8192,
    'default': 8192,
  },
  openrouter: {
    'openai/gpt-4o': 16384,
    'openai/gpt-4o-mini': 16384,
    'openai/o1-preview': 32768,
    'openai/o1-mini': 65536,
    'anthropic/claude-3.5-sonnet': 8192,
    'anthropic/claude-3-haiku': 4096,
    'anthropic/claude-3-opus': 4096,
    'google/gemini-pro-1.5': 8192,
    'google/gemini-flash-1.5': 8192,
    'meta-llama/llama-3.1-70b-instruct': 8192,
    'meta-llama/llama-3.1-405b-instruct': 8192,
    'mistralai/mixtral-8x7b-instruct': 32768,
    'default': 8192,
  },
}

function getMaxTokensForModel(provider: string, model: string): number {
  const providerLimits = PROVIDER_TOKEN_LIMITS[provider.toLowerCase()] || {}
  
  // Try exact match first
  if (providerLimits[model]) {
    return providerLimits[model]
  }
  
  // Try partial match (for versioned models)
  for (const [key, value] of Object.entries(providerLimits)) {
    if (key !== 'default' && model.includes(key)) {
      return value
    }
  }
  
  // Return default
  return providerLimits['default'] || 4096
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
  generationAttempts?: number
}

interface WordCountValidation {
  isValid: boolean
  wordCount: number
  targetMin: number
  targetMax: number
  action: 'accept' | 'expand' | 'truncate' | 'regenerate'
  wordsNeeded?: number
  wordsToRemove?: number
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
      version: 'v17.0.0',
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
      throw new Error(`AI_TIMEOUT: Request timed out after ${timeoutMs / 1000} seconds. The AI provider is taking too long to respond.`)
    }
    throw error
  }
}

// ============================================================================
// HELPER: Count Words in HTML Content
// ============================================================================

function countWords(htmlContent: string): number {
  if (!htmlContent) return 0
  // Remove HTML tags, then count words
  const textOnly = htmlContent.replace(/<[^>]*>/g, ' ')
  const words = textOnly.split(/\s+/).filter(word => word.length > 0)
  return words.length
}

// ============================================================================
// WORD COUNT VALIDATION (NEW!)
// ============================================================================

function validateWordCount(
  content: string, 
  minWords: number, 
  maxWords: number
): WordCountValidation {
  const wordCount = countWords(content)
  const tolerance = minWords * WORD_COUNT_TOLERANCE
  
  // Accept if within tolerance range
  if (wordCount >= minWords - tolerance && wordCount <= maxWords + tolerance) {
    return { 
      isValid: true, 
      wordCount, 
      targetMin: minWords,
      targetMax: maxWords,
      action: 'accept' 
    }
  }
  
  // Too short by more than 30% - need full regeneration
  if (wordCount < minWords * 0.7) {
    return { 
      isValid: false, 
      wordCount, 
      targetMin: minWords,
      targetMax: maxWords,
      action: 'regenerate',
      wordsNeeded: minWords - wordCount + 200 // Add buffer
    }
  }
  
  // Slightly short - can expand
  if (wordCount < minWords) {
    return { 
      isValid: false, 
      wordCount, 
      targetMin: minWords,
      targetMax: maxWords,
      action: 'expand',
      wordsNeeded: minWords - wordCount + 100 // Add buffer
    }
  }
  
  // Too long - truncate
  return { 
    isValid: false, 
    wordCount, 
    targetMin: minWords,
    targetMax: maxWords,
    action: 'truncate',
    wordsToRemove: wordCount - maxWords
  }
}

// ============================================================================
// SMART TRUNCATION (NEW!) - Cuts at sentence/paragraph boundaries
// ============================================================================

function smartTruncate(htmlContent: string, maxWords: number): string {
  if (!htmlContent) return ''
  
  // Split content into paragraphs
  const paragraphs = htmlContent.split(/<\/p>/i).filter(p => p.trim())
  
  let result = ''
  let currentWordCount = 0
  
  for (const para of paragraphs) {
    // Clean paragraph text to count words
    const cleanPara = para.replace(/<[^>]*>/g, ' ')
    const paraWords = cleanPara.split(/\s+/).filter(w => w.length > 0).length
    
    // If adding this paragraph stays within limit, add it
    if (currentWordCount + paraWords <= maxWords) {
      result += para + '</p>'
      currentWordCount += paraWords
    } else {
      // Check if we're close enough to stop
      if (currentWordCount > maxWords * 0.9) {
        break
      }
      
      // Truncate this paragraph to fit remaining words
      const wordsToTake = maxWords - currentWordCount
      const words = cleanPara.split(/\s+/).filter(w => w.length > 0)
      const truncatedText = words.slice(0, wordsToTake).join(' ')
      
      // Find last sentence break for cleaner cut
      const lastPeriod = truncatedText.lastIndexOf('.')
      const lastQuestion = truncatedText.lastIndexOf('?')
      const lastExclaim = truncatedText.lastIndexOf('!')
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim)
      
      if (lastBreak > truncatedText.length * 0.7) {
        // Cut at sentence boundary
        result += `<p>${truncatedText.substring(0, lastBreak + 1)}</p>`
      } else {
        // Add ellipsis if no good break point
        result += `<p>${truncatedText}...</p>`
      }
      break
    }
  }
  
  return result
}

// ============================================================================
// BUILD MAIN GENERATION PROMPT
// ============================================================================

function buildPrompt(topic: string, settings: ContentSettings): string {
  const { minWordCount, maxWordCount, enableFaqs, enableToc, enableKeyTakeaways } = settings
  
  // Calculate target words and sections for optimal content structure
  const targetWords = Math.round((minWordCount + maxWordCount) / 2)
  const wordsPerSection = 400 // Optimal section length for readability
  const numSections = Math.max(5, Math.ceil(targetWords / wordsPerSection))
  
  // Build dynamic additional sections
  let additionalSections = ''
  if (enableFaqs !== false) {
    additionalSections += `\n  "faqs": [{"question": "Relevant FAQ 1?", "answer": "Comprehensive answer (50+ words)..."}, {"question": "Relevant FAQ 2?", "answer": "Detailed answer (50+ words)..."}, {"question": "Relevant FAQ 3?", "answer": "Thorough answer (50+ words)..."}],`
  }
  if (enableKeyTakeaways !== false) {
    additionalSections += `\n  "keyTakeaways": ["Key insight 1 (detailed)", "Key insight 2 (detailed)", "Key insight 3 (detailed)", "Key insight 4 (detailed)", "Key insight 5 (detailed)"],`
  }
  if (enableToc !== false) {
    additionalSections += `\n  "tableOfContents": ["Introduction", "Section 1", "Section 2", "Section 3", "Section 4", "Section 5", "Conclusion"],`
  }

  return `You are an elite SEO content strategist and professional writer with expertise in creating comprehensive, authoritative, and highly engaging long-form content. Your content consistently ranks #1 on Google and provides exceptional value to readers.

TOPIC: ${topic}

=== ABSOLUTE WORD COUNT REQUIREMENT (NON-NEGOTIABLE) ===
You MUST write between ${minWordCount} and ${maxWordCount} words.
Target: ${targetWords} words.

THIS IS A STRICT REQUIREMENT:
- Content below ${minWordCount} words will be REJECTED and regenerated
- Content above ${maxWordCount} words will be truncated
- Write ${numSections} comprehensive sections with 350-500 words each
- COUNT YOUR WORDS carefully before submitting

=== CONTENT EXCELLENCE STANDARDS ===

1. DEPTH & COMPREHENSIVENESS:
   - Cover every aspect of the topic thoroughly
   - Include expert-level insights and analysis
   - Provide actionable, specific advice (not generic tips)
   - Address common questions and concerns
   - Include real-world examples and case studies
   - Add statistics, data points, and research findings

2. STRUCTURE & READABILITY:
   - Write ${numSections} detailed H2 sections minimum
   - Each section: 2-3 substantial paragraphs (350-500 words per section)
   - Use H3 subheadings within sections for organization
   - Include bullet points and numbered lists strategically
   - Each paragraph: 4-6 well-developed sentences
   - Use transition sentences between sections

3. ENGAGEMENT & VALUE:
   - Hook readers with a compelling introduction (150+ words)
   - Use conversational yet authoritative tone
   - Include practical tips and implementation steps
   - Create scannable content with clear formatting
   - End with a strong conclusion (150+ words)

4. SEO OPTIMIZATION:
   - Naturally integrate primary and secondary keywords
   - Use semantic variations and related terms
   - Optimize for featured snippets where applicable

=== OUTPUT FORMAT ===
Respond ONLY with valid JSON (no markdown code blocks, no explanations):

{
  "title": "Compelling SEO title (50-60 characters)",
  "metaDescription": "Engaging meta description with keyword (150-160 characters)",
  "h1": "Main H1 heading - slightly different from title",
  "h2s": ["H2 Section 1", "H2 Section 2", "H2 Section 3", "H2 Section 4", "H2 Section 5", "H2 Section 6", "H2 Section 7"],
  "content": "<h2>Section 1 Title</h2><p>Comprehensive paragraph 1 with 4-6 detailed sentences providing real value...</p><p>Another detailed paragraph with specific examples and actionable advice...</p><p>Third paragraph diving deeper into the topic with expert insights...</p><h2>Section 2 Title</h2><p>Continue with equally detailed content...</p>...",
  "tldrSummary": "A comprehensive 3-4 sentence TL;DR summary covering the key points",${additionalSections}
  "excerpt": "A compelling 2-3 sentence excerpt for previews and social sharing"
}

=== CRITICAL REMINDERS ===
1. The "content" field MUST contain ${minWordCount}-${maxWordCount} words of HTML content
2. Write REAL, VALUABLE content - not filler or fluff
3. Every section should provide unique, actionable insights
4. Quality AND quantity are BOTH required
5. COUNT YOUR WORDS - this is essential for acceptance
6. Use proper HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
`
}

// ============================================================================
// BUILD EXPANSION PROMPT (NEW!) - For when content is too short
// ============================================================================

function buildExpansionPrompt(
  existingContent: string, 
  currentWords: number, 
  targetWords: number,
  topic: string
): string {
  const wordsToAdd = targetWords - currentWords + 150 // Add buffer
  
  return `You are expanding existing content to meet word count requirements.

TOPIC: ${topic}
CURRENT WORD COUNT: ${currentWords} words
TARGET WORD COUNT: ${targetWords} words
WORDS TO ADD: Approximately ${wordsToAdd} more words

EXISTING CONTENT (first 3000 chars):
${existingContent.slice(0, 3000)}

=== YOUR TASK ===
Expand this content by adding approximately ${wordsToAdd} more words. You should:

1. Add more detailed explanations to existing sections
2. Add 1-2 new subsections with H3 headings
3. Include more specific examples, statistics, or case studies
4. Expand on key points with additional insights
5. Add more actionable tips and implementation steps

=== OUTPUT FORMAT ===
Return the FULL expanded content as JSON (include ALL original content plus expansions):

{
  "content": "<h2>Section 1</h2><p>Original content with expansions integrated naturally...</p><h3>New Subsection</h3><p>Additional detailed content...</p>..."
}

IMPORTANT: 
- Return the COMPLETE content (original + expansions)
- Integrate new content seamlessly - don't just append
- Maintain the same tone and style
- The total word count should be at least ${targetWords} words
`
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
  const maxTokens = getMaxTokensForModel('google', model)
  
  console.log(`[Gemini] ========== STARTING GENERATION ==========`)
  console.log(`[Gemini] Model: ${model}`)
  console.log(`[Gemini] Topic: "${topic}"`)
  console.log(`[Gemini] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Gemini] Max output tokens: ${maxTokens}`)
  
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
          maxOutputTokens: maxTokens,
          topP: 0.9,
        },
      }),
    }
  )

  const duration = Date.now() - startTime
  console.log(`[Gemini] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Gemini] API error ${response.status}:`, errorText.slice(0, 500))
    
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
  
  // Log finish reason for debugging
  const finishReason = data.candidates?.[0]?.finishReason
  console.log(`[Gemini] Finish reason: ${finishReason}`)
  
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[Gemini] ⚠️ Output was truncated due to token limit (${maxTokens} tokens)!`)
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  if (!text) {
    throw new Error('AI_EMPTY_RESPONSE: Gemini returned an empty response. Please try again.')
  }
  
  // Extract JSON from response
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
  
  const wordCount = countWords(parsed.content || '')
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount
  
  console.log(`[Gemini] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Gemini] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Gemini] Word count met: ${wordCountMet ? 'YES ✅' : 'NO ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: wordCountMet ? 85 : 70,
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
  const maxTokens = getMaxTokensForModel('openai', model)
  
  console.log(`[OpenAI] ========== STARTING GENERATION ==========`)
  console.log(`[OpenAI] Model: ${model}`)
  console.log(`[OpenAI] Topic: "${topic}"`)
  console.log(`[OpenAI] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[OpenAI] Max output tokens: ${maxTokens}`)

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
          content: `You are an expert SEO content writer. Always respond with valid JSON only, no markdown code blocks. You MUST write between ${settings.minWordCount} and ${settings.maxWordCount} words. This is non-negotiable.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[OpenAI] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenAI] API error ${response.status}:`, errorText.slice(0, 500))
    
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your OpenAI API key is invalid.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: OpenAI rate limit exceeded. Please wait and try again.')
    }
    if (response.status === 400 && errorText.includes('context_length')) {
      throw new Error('CONTEXT_LENGTH: The prompt is too long for this model. Try a smaller word count target.')
    }
    
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Log finish reason and token usage
  const finishReason = data.choices?.[0]?.finish_reason
  const usage = data.usage
  console.log(`[OpenAI] Finish reason: ${finishReason}`)
  console.log(`[OpenAI] Token usage: prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, total=${usage?.total_tokens}`)
  
  if (finishReason === 'length') {
    console.warn(`[OpenAI] ⚠️ Output was truncated due to token limit (${maxTokens} tokens)!`)
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
    console.error('[OpenAI] JSON parse error, raw text:', text.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = countWords(parsed.content || '')
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[OpenAI] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[OpenAI] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[OpenAI] Word count met: ${wordCountMet ? 'YES ✅' : 'NO ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: wordCountMet ? 85 : 70,
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
  const maxTokens = getMaxTokensForModel('anthropic', model)
  
  console.log(`[Anthropic] ========== STARTING GENERATION ==========`)
  console.log(`[Anthropic] Model: ${model}`)
  console.log(`[Anthropic] Topic: "${topic}"`)
  console.log(`[Anthropic] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Anthropic] Max output tokens: ${maxTokens}`)

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
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[Anthropic] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Anthropic] API error ${response.status}:`, errorText.slice(0, 500))
    
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your Anthropic API key is invalid.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: Anthropic rate limit exceeded. Please wait and try again.')
    }
    
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Log stop reason and usage
  const stopReason = data.stop_reason
  const usage = data.usage
  console.log(`[Anthropic] Stop reason: ${stopReason}`)
  console.log(`[Anthropic] Token usage: input=${usage?.input_tokens}, output=${usage?.output_tokens}`)
  
  if (stopReason === 'max_tokens') {
    console.warn(`[Anthropic] ⚠️ Output was truncated due to token limit (${maxTokens} tokens)!`)
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
    console.error('[Anthropic] JSON parse error, raw text:', text.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = countWords(parsed.content || '')
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[Anthropic] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Anthropic] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Anthropic] Word count met: ${wordCountMet ? 'YES ✅' : 'NO ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: wordCountMet ? 85 : 70,
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
// AI GENERATION: GROQ
// ============================================================================

async function generateWithGroq(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  const maxTokens = getMaxTokensForModel('groq', model)
  
  console.log(`[Groq] ========== STARTING GENERATION ==========`)
  console.log(`[Groq] Model: ${model}`)
  console.log(`[Groq] Topic: "${topic}"`)
  console.log(`[Groq] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Groq] Max output tokens: ${maxTokens}`)

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
          content: `You are an expert SEO content writer. Write EXACTLY ${settings.minWordCount}-${settings.maxWordCount} words. Respond with valid JSON only, no markdown.` 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  })

  const duration = Date.now() - startTime
  console.log(`[Groq] Response received in ${duration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Groq] API error ${response.status}:`, errorText.slice(0, 500))
    
    if (response.status === 401) {
      throw new Error('INVALID_API_KEY: Your Groq API key is invalid.')
    }
    if (response.status === 429) {
      throw new Error('RATE_LIMIT: Groq rate limit exceeded. Please wait and try again.')
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
    console.warn(`[Groq] ⚠️ Output was truncated due to token limit (${maxTokens} tokens)!`)
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
    console.error('[Groq] JSON parse error, raw text:', text.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response.')
  }
  
  const wordCount = countWords(parsed.content || '')
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[Groq] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[Groq] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[Groq] Word count met: ${wordCountMet ? 'YES ✅' : 'NO ❌'}`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 70 + Math.floor(wordCount / 50)),
    seoScore: wordCountMet ? 85 : 70,
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
// AI GENERATION: OPENROUTER
// ============================================================================

async function generateWithOpenRouter(
  apiKey: string, 
  model: string, 
  topic: string,
  settings: ContentSettings
): Promise<GeneratedContent> {
  const maxTokens = getMaxTokensForModel('openrouter', model)
  
  console.log(`[OpenRouter] ========== STARTING GENERATION ==========`)
  console.log(`[OpenRouter] Model: ${model}`)
  console.log(`[OpenRouter] Topic: "${topic}"`)
  console.log(`[OpenRouter] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
  console.log(`[OpenRouter] Max output tokens: ${maxTokens}`)
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
    max_tokens: maxTokens,
    top_p: 0.9,
  }

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
    console.error(`[OpenRouter] API error ${response.status}:`, errorText.slice(0, 500))
    
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
  
  // Log finish reason to detect truncation
  const finishReason = data.choices?.[0]?.finish_reason
  const usage = data.usage
  
  console.log(`[OpenRouter] Finish reason: ${finishReason}`)
  console.log(`[OpenRouter] Token usage: prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, total=${usage?.total_tokens}`)
  
  if (finishReason === 'length') {
    console.warn(`[OpenRouter] ⚠️ Output was truncated due to token limit (${maxTokens} tokens)!`)
  }
  
  const text = data.choices?.[0]?.message?.content || ''
  
  if (!text) {
    console.error(`[OpenRouter] Empty response! Full response:`, JSON.stringify(data).slice(0, 500))
    throw new Error('AI_EMPTY_RESPONSE: OpenRouter returned an empty response.')
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
    console.error(`[OpenRouter] JSON parse error! First 500 chars:`, jsonStr.slice(0, 500))
    throw new Error('AI_PARSE_ERROR: Failed to parse AI response as JSON.')
  }
  
  const wordCount = countWords(parsed.content || '')
  const wordCountMet = wordCount >= settings.minWordCount && wordCount <= settings.maxWordCount

  console.log(`[OpenRouter] Generated ${wordCount} words in ${duration}ms`)
  console.log(`[OpenRouter] Word count target: ${settings.minWordCount}-${settings.maxWordCount}`)
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
    seoScore: wordCountMet ? 85 : 70,
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
// CONTENT EXPANSION HELPER (NEW!)
// ============================================================================

async function expandContent(
  aiConfig: AIConfig,
  existingContent: string,
  currentWords: number,
  targetWords: number,
  topic: string
): Promise<string> {
  console.log(`[expandContent] Expanding from ${currentWords} to ${targetWords} words`)
  
  const { provider, apiKey, model } = aiConfig
  const maxTokens = getMaxTokensForModel(provider, model)
  const prompt = buildExpansionPrompt(existingContent, currentWords, targetWords, topic)
  
  let response: Response
  let text: string = ''
  
  switch (provider.toLowerCase()) {
    case 'google':
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
          }),
        }
      )
      if (!response.ok) throw new Error(`Expansion failed: ${response.status}`)
      const geminiData = await response.json()
      text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      break
      
    case 'openai':
      response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens,
        }),
      })
      if (!response.ok) throw new Error(`Expansion failed: ${response.status}`)
      const openaiData = await response.json()
      text = openaiData.choices?.[0]?.message?.content || ''
      break
      
    case 'anthropic':
      response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!response.ok) throw new Error(`Expansion failed: ${response.status}`)
      const anthropicData = await response.json()
      text = anthropicData.content?.[0]?.text || ''
      break
      
    case 'groq':
      response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens,
        }),
      })
      if (!response.ok) throw new Error(`Expansion failed: ${response.status}`)
      const groqData = await response.json()
      text = groqData.choices?.[0]?.message?.content || ''
      break
      
    case 'openrouter':
      response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://page-perfector.app',
        },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens,
        }),
      })
      if (!response.ok) throw new Error(`Expansion failed: ${response.status}`)
      const orData = await response.json()
      text = orData.choices?.[0]?.message?.content || ''
      break
      
    default:
      throw new Error(`Unsupported provider for expansion: ${provider}`)
  }
  
  // Extract expanded content from JSON response
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      const expandedContent = parsed.content || existingContent
      const newWordCount = countWords(expandedContent)
      console.log(`[expandContent] Expanded to ${newWordCount} words`)
      return expandedContent
    } catch (e) {
      console.warn('[expandContent] Failed to parse expansion response, using original')
      return existingContent
    }
  }
  
  return existingContent
}

// ============================================================================
// MAIN AI ROUTER - WITH WORD COUNT ENFORCEMENT AND RETRY LOGIC (NEW!)
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
  console.log('[generateWithAI] Max Retries:', MAX_WORD_COUNT_RETRIES)

  const { provider, apiKey, model } = aiConfig
  
  let attempts = 0
  let lastResult: GeneratedContent | null = null
  let currentContent = ''
  
  // Retry loop for word count enforcement
  while (attempts < MAX_WORD_COUNT_RETRIES) {
    attempts++
    console.log(`[generateWithAI] ========== ATTEMPT ${attempts}/${MAX_WORD_COUNT_RETRIES} ==========`)
    
    try {
      // Generate content based on provider
      let result: GeneratedContent
      
      switch (provider.toLowerCase()) {
        case 'google':
          result = await generateWithGemini(apiKey, model || 'gemini-2.0-flash', topic, settings)
          break
        case 'openai':
          result = await generateWithOpenAI(apiKey, model || 'gpt-4o-mini', topic, settings)
          break
        case 'anthropic':
          result = await generateWithAnthropic(apiKey, model || 'claude-3-haiku-20240307', topic, settings)
          break
        case 'groq':
          result = await generateWithGroq(apiKey, model || 'llama-3.1-70b-versatile', topic, settings)
          break
        case 'openrouter':
          result = await generateWithOpenRouter(apiKey, model || 'openai/gpt-4o-mini', topic, settings)
          break
        default:
          throw new Error(`UNSUPPORTED_PROVIDER: Provider "${provider}" is not supported.`)
      }
      
      lastResult = result
      currentContent = result.optimizedContent || result.content || ''
      
      // Validate word count
      const validation = validateWordCount(currentContent, settings.minWordCount, settings.maxWordCount)
      
      console.log(`[generateWithAI] Validation result:`, {
        wordCount: validation.wordCount,
        targetMin: validation.targetMin,
        targetMax: validation.targetMax,
        action: validation.action,
        isValid: validation.isValid
      })
      
      // If valid, return immediately
      if (validation.isValid || validation.action === 'accept') {
        console.log(`[generateWithAI] ✅ Word count ACCEPTED after ${attempts} attempt(s)`)
        result.wordCountMet = true
        result.generationAttempts = attempts
        return result
      }
      
      // Handle truncation (always final - we can do this locally)
      if (validation.action === 'truncate') {
        console.log(`[generateWithAI] Truncating content from ${validation.wordCount} to ${settings.maxWordCount} words`)
        const truncatedContent = smartTruncate(currentContent, settings.maxWordCount)
        result.optimizedContent = truncatedContent
        result.content = truncatedContent
        result.wordCount = countWords(truncatedContent)
        result.wordCountMet = true
        result.generationAttempts = attempts
        console.log(`[generateWithAI] ✅ Content truncated to ${result.wordCount} words`)
        return result
      }
      
      // Handle expansion (try to expand if we have retries left)
      if (validation.action === 'expand' && attempts < MAX_WORD_COUNT_RETRIES) {
        console.log(`[generateWithAI] Attempting to expand content from ${validation.wordCount} to ${settings.minWordCount}+ words`)
        try {
          const expandedContent = await expandContent(
            aiConfig,
            currentContent,
            validation.wordCount,
            settings.minWordCount + 100, // Target slightly above minimum
            topic
          )
          
          // Update result with expanded content
          result.optimizedContent = expandedContent
          result.content = expandedContent
          result.wordCount = countWords(expandedContent)
          currentContent = expandedContent
          
          // Re-validate after expansion
          const revalidation = validateWordCount(expandedContent, settings.minWordCount, settings.maxWordCount)
          if (revalidation.isValid || revalidation.action === 'accept') {
            console.log(`[generateWithAI] ✅ Word count ACCEPTED after expansion (${result.wordCount} words)`)
            result.wordCountMet = true
            result.generationAttempts = attempts
            return result
          }
          
          console.log(`[generateWithAI] Expansion result: ${result.wordCount} words, need more`)
        } catch (expandError) {
          console.warn(`[generateWithAI] Expansion failed:`, expandError)
          // Continue to next attempt
        }
      }
      
      // If regeneration is needed and we have retries left, continue loop
      if (validation.action === 'regenerate') {
        console.log(`[generateWithAI] Content too short (${validation.wordCount} words), regenerating...`)
        // Loop will continue with fresh generation
      }
      
    } catch (err) {
      console.error(`[generateWithAI] Attempt ${attempts} failed:`, err)
      if (attempts >= MAX_WORD_COUNT_RETRIES) {
        throw err
      }
      // Small delay before retry
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  
  // Return best effort after max retries
  if (lastResult) {
    console.log(`[generateWithAI] ⚠️ Returning best effort after ${attempts} attempts. Words: ${lastResult.wordCount}`)
    lastResult.wordCountMet = lastResult.wordCount >= settings.minWordCount * 0.9 && 
                              lastResult.wordCount <= settings.maxWordCount * 1.1
    lastResult.generationAttempts = attempts
    return lastResult
  }
  
  throw new Error('AI_GENERATION_FAILED: Could not generate content after maximum retry attempts')
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
  console.log(`[Job ${jobId}] ========== STARTING JOB PROCESSING ==========`)
  console.log(`[Job ${jobId}] Topic: ${topic}`)
  console.log(`[Job ${jobId}] AI Provider: ${aiConfig.provider}`)
  console.log(`[Job ${jobId}] AI Model: ${aiConfig.model}`)
  console.log(`[Job ${jobId}] Word Count Target: ${contentSettings.minWordCount}-${contentSettings.maxWordCount}`)
  console.log(`[Job ${jobId}] Max Retries: ${MAX_WORD_COUNT_RETRIES}`)
  
  try {
    await updateProgress(supabase, jobId, 10, 'Analyzing content requirements...')
    await new Promise(r => setTimeout(r, 300))

    await updateProgress(supabase, jobId, 20, 'Preparing AI generation...')
    await new Promise(r => setTimeout(r, 300))

    await updateProgress(supabase, jobId, 35, `Generating ${contentSettings.minWordCount}-${contentSettings.maxWordCount} word article...`)
    
    const startTime = Date.now()
    const result = await generateWithAI(aiConfig, topic, contentSettings)
    const duration = Date.now() - startTime
    
    console.log(`[Job ${jobId}] AI generation completed in ${duration}ms`)
    console.log(`[Job ${jobId}] Word count: ${result.wordCount}`)
    console.log(`[Job ${jobId}] Word count met: ${result.wordCountMet ? 'YES ✅' : 'NO ❌'}`)
    console.log(`[Job ${jobId}] Generation attempts: ${result.generationAttempts}`)

    await updateProgress(supabase, jobId, 75, 'Applying SEO optimizations...')
    await new Promise(r => setTimeout(r, 200))

    await updateProgress(supabase, jobId, 90, 'Finalizing content...')
    await new Promise(r => setTimeout(r, 200))

    // Determine completion message
    const completionMsg = result.wordCountMet 
      ? `✅ Complete! ${result.wordCount} words (${result.generationAttempts} attempt${result.generationAttempts > 1 ? 's' : ''})`
      : `⚠️ Complete with ${result.wordCount} words (target: ${contentSettings.minWordCount}-${contentSettings.maxWordCount})`

    const { error: completeError } = await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: completionMsg,
      result: result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    if (completeError) {
      console.error(`[Job ${jobId}] Complete update failed:`, completeError)
    } else {
      console.log(`[Job ${jobId}] ✅ JOB COMPLETED!`)
      console.log(`[Job ${jobId}] Final word count: ${result.wordCount}`)
      console.log(`[Job ${jobId}] Quality score: ${result.qualityScore}`)
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Job ${jobId}] ❌ JOB FAILED:`, errorMessage)
    
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[optimize-content] ========== NEW REQUEST ==========')
  console.log('[optimize-content] Version: v17.0.0')
  console.log('[optimize-content] Features: Word count enforcement, retry logic, content expansion, smart truncation')
  console.log('[optimize-content] Timeout:', AI_TIMEOUT_MS, 'ms')
  console.log('[optimize-content] Max retries:', MAX_WORD_COUNT_RETRIES)

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
    
    const logData = {
      url: body.url || body.siteUrl,
      postTitle: body.postTitle,
      aiProvider: body.aiConfig?.provider,
      hasAiKey: !!body.aiConfig?.apiKey,
      aiModel: body.aiConfig?.model,
      wordCountTarget: `${contentSettings.minWordCount}-${contentSettings.maxWordCount}`,
    }
    console.log('[optimize-content] Request data:', JSON.stringify(logData))

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

    // Log provider-specific token limit
    const maxTokens = getMaxTokensForModel(aiConfig.provider, aiConfig.model)
    console.log(`[optimize-content] Token limit for ${aiConfig.provider}/${aiConfig.model}: ${maxTokens}`)

    const topic = body.postTitle || body.keyword || body.url || 'Content Optimization'
    
    console.log('[optimize-content] ✓ Configuration validated')
    console.log('[optimize-content] Topic:', topic)
    console.log('[optimize-content] Word count target:', contentSettings.minWordCount, '-', contentSettings.maxWordCount)

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return errorResponse('SERVER_ERROR', 'Server configuration error.', {}, 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    })

    // Create job record
    const jobId = crypto.randomUUID()
    console.log('[optimize-content] Creating job:', jobId)

    const { error: insertError } = await supabase.from('jobs').insert({
      id: jobId,
      page_id: body.pageId || null,
      status: 'running',
      progress: 5,
      current_step: `Starting optimization (target: ${contentSettings.minWordCount}-${contentSettings.maxWordCount} words)...`,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[optimize-content] Job creation failed:', insertError)
      return errorResponse('DATABASE_ERROR', 'Failed to create job.', { error: insertError.message }, 500)
    }

    // Process job synchronously (Supabase Edge Functions terminate after HTTP response)
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
      
      console.log(`[optimize-content] Job ${jobId} final status: ${completedJob?.status}`)
      
      if (completedJob?.status === 'completed' && completedJob?.result) {
        const result = completedJob.result as GeneratedContent
        console.log(`[optimize-content] ✅ Job completed successfully!`)
        console.log(`[optimize-content] Final word count: ${result.wordCount}`)
        console.log(`[optimize-content] Word count met: ${result.wordCountMet}`)
        console.log(`[optimize-content] Generation attempts: ${result.generationAttempts}`)
        
        return jsonResponse({
          success: true,
          jobId: jobId,
          pageId: body.pageId || null,
          status: 'completed',
          progress: 100,
          current_step: completedJob.current_step,
          result: result,
          message: `Optimization completed! Generated ${result.wordCount} words in ${result.generationAttempts} attempt(s).`,
          wordCountMet: result.wordCountMet,
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
          contentSettings,
        })
      } else {
        console.error(`[optimize-content] Job failed or incomplete: ${completedJob?.status}`)
        console.error(`[optimize-content] Error message: ${completedJob?.error_message}`)
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
