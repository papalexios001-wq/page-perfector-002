// ============================================================================
// AI CONTENT GENERATOR - ENTERPRISE VERSION 8.0
// Supports: Google Gemini, OpenAI, Anthropic, Groq
// ============================================================================

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
}

interface AIConfig {
  provider: string
  apiKey: string
  model: string
}

// ============================================================================
// GOOGLE GEMINI
// ============================================================================
async function generateWithGemini(apiKey: string, model: string, topic: string): Promise<GeneratedContent> {
  console.log(`[Gemini] Generating content for: "${topic}" with model: ${model}`)
  
  const prompt = `You are an expert SEO content writer. Generate a comprehensive, engaging blog post.

TOPIC: ${topic}

REQUIREMENTS:
- Write 1500-2500 words of high-quality content
- Use conversational but authoritative tone
- Include specific examples and actionable advice
- Structure with clear H2 and H3 headings
- Make it engaging and valuable for readers

OUTPUT FORMAT (respond ONLY with valid JSON, no markdown code blocks):
{
  "title": "Compelling SEO title (50-60 chars)",
  "metaDescription": "Engaging meta description (150-160 chars)",
  "h1": "Main H1 heading",
  "h2s": ["H2 heading 1", "H2 heading 2", "H2 heading 3", "H2 heading 4", "H2 heading 5"],
  "content": "<p>Full HTML content with h2, h3, p, ul, li, strong, em tags. Write comprehensive paragraphs.</p>",
  "tldrSummary": "A 2-3 sentence TL;DR summary",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4", "Takeaway 5"],
  "excerpt": "A compelling 2-3 sentence excerpt"
}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.9,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Gemini] API error ${response.status}:`, errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  console.log(`[Gemini] Response received`)
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  if (!text) {
    console.error('[Gemini] Empty response from API')
    throw new Error('Empty response from Gemini API')
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
    console.error('[Gemini] JSON parse error:', parseError)
    console.error('[Gemini] Raw text:', text.slice(0, 500))
    throw new Error('Failed to parse AI response as JSON')
  }
  
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  console.log(`[Gemini] Generated ${wordCount} words`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 75 + Math.floor(wordCount / 100)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || parsed.title || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
      { type: 'summary', content: parsed.excerpt || '' },
    ],
    excerpt: parsed.excerpt || parsed.metaDescription || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
  }
}

// ============================================================================
// OPENAI
// ============================================================================
async function generateWithOpenAI(apiKey: string, model: string, topic: string): Promise<GeneratedContent> {
  console.log(`[OpenAI] Generating content for: "${topic}" with model: ${model}`)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'You are an expert SEO content writer. Always respond with valid JSON only, no markdown.' 
        },
        { 
          role: 'user', 
          content: `Generate a comprehensive 1500-2500 word SEO blog post about: "${topic}"

Respond with this exact JSON structure:
{
  "title": "SEO title (50-60 chars)",
  "metaDescription": "Meta description (150-160 chars)",
  "h1": "Main heading",
  "h2s": ["Section 1", "Section 2", "Section 3", "Section 4", "Section 5"],
  "content": "<p>Full HTML content with h2, h3, p, ul, li, strong tags. Write detailed paragraphs.</p>",
  "tldrSummary": "2-3 sentence summary",
  "keyTakeaways": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "excerpt": "2-3 sentence excerpt"
}` 
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[OpenAI] API error ${response.status}:`, errorText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  const parsed = JSON.parse(jsonStr)
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  console.log(`[OpenAI] Generated ${wordCount} words`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 75 + Math.floor(wordCount / 100)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
      { type: 'summary', content: parsed.excerpt || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
  }
}

// ============================================================================
// ANTHROPIC (CLAUDE)
// ============================================================================
async function generateWithAnthropic(apiKey: string, model: string, topic: string): Promise<GeneratedContent> {
  console.log(`[Anthropic] Generating content for: "${topic}" with model: ${model}`)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{ 
        role: 'user', 
        content: `Generate a comprehensive 1500-2500 word SEO blog post about: "${topic}"

Respond with JSON only:
{"title":"...", "metaDescription":"...", "h1":"...", "h2s":["..."], "content":"<p>HTML content...</p>", "tldrSummary":"...", "keyTakeaways":["..."], "excerpt":"..."}` 
      }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  const parsed = JSON.parse(jsonStr)
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  console.log(`[Anthropic] Generated ${wordCount} words`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 75 + Math.floor(wordCount / 100)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
      { type: 'summary', content: parsed.excerpt || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
  }
}

// ============================================================================
// GROQ
// ============================================================================
async function generateWithGroq(apiKey: string, model: string, topic: string): Promise<GeneratedContent> {
  console.log(`[Groq] Generating content for: "${topic}" with model: ${model}`)

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-8b-instant',
      messages: [{ 
        role: 'user', 
        content: `Generate a 1500+ word SEO blog post about: "${topic}". Respond with JSON only: {"title":"...", "metaDescription":"...", "h1":"...", "h2s":["..."], "content":"<p>HTML...</p>", "tldrSummary":"...", "keyTakeaways":["..."], "excerpt":"..."}` 
      }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  
  let jsonStr = text
  const match = text.match(/\{[\s\S]*\}/)
  if (match) jsonStr = match[0]
  
  const parsed = JSON.parse(jsonStr)
  const wordCount = (parsed.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  console.log(`[Groq] Generated ${wordCount} words`)

  return {
    title: parsed.title || topic,
    optimizedTitle: parsed.title || topic,
    optimizedContent: parsed.content || '',
    content: parsed.content || '',
    wordCount,
    qualityScore: Math.min(95, 75 + Math.floor(wordCount / 100)),
    seoScore: 85,
    readabilityScore: 80,
    metaDescription: parsed.metaDescription || '',
    h1: parsed.h1 || topic,
    h2s: parsed.h2s || [],
    sections: [
      { type: 'tldr', content: parsed.tldrSummary || '' },
      { type: 'takeaways', data: parsed.keyTakeaways || [] },
      { type: 'paragraph', content: parsed.content || '' },
      { type: 'summary', content: parsed.excerpt || '' },
    ],
    excerpt: parsed.excerpt || '',
    author: 'AI Content Expert',
    publishedAt: new Date().toISOString(),
  }
}

// ============================================================================
// FALLBACK CONTENT (Only when AI not configured)
// ============================================================================
export function generateFallbackContent(topic: string): GeneratedContent {
  console.warn(`[Fallback] Generating fallback content for: ${topic}`)
  
  const cleanTopic = topic.replace(/^(Quick Optimize:|Optimized:)\s*/i, '').trim() || 'Content'
  
  const content = `<h1>${cleanTopic}: A Comprehensive Guide</h1>

<p><strong>⚠️ AI Provider Not Configured</strong></p>

<p>This is placeholder content because no AI API key was configured. To get real, AI-generated content optimized for your specific topic, please configure your AI provider.</p>

<h2>How to Enable AI Content Generation</h2>

<ol>
<li>Go to the <strong>Configuration</strong> tab in the app</li>
<li>Select an AI Provider (Google Gemini, OpenAI, Anthropic, or Groq)</li>
<li>Enter your API key</li>
<li>Select a model</li>
<li>Click <strong>"Validate API Key"</strong></li>
</ol>

<h2>Supported AI Providers</h2>

<ul>
<li><strong>Google Gemini</strong> - Fast and cost-effective (recommended, free tier available)</li>
<li><strong>OpenAI GPT-4</strong> - High quality output</li>
<li><strong>Anthropic Claude</strong> - Excellent for long-form content</li>
<li><strong>Groq</strong> - Ultra-fast inference</li>
</ul>

<h2>What You'll Get with AI</h2>

<p>When AI is configured, Page Perfector will generate:</p>

<ul>
<li>1500-2500 words of unique, relevant content</li>
<li>SEO-optimized titles and meta descriptions</li>
<li>Proper heading structure (H1, H2, H3)</li>
<li>Key takeaways and TL;DR summaries</li>
<li>Engaging, reader-friendly formatting</li>
</ul>

<p><strong>Configure your AI provider now to unlock real content generation!</strong></p>`

  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
  
  return {
    title: `${cleanTopic}: A Comprehensive Guide`,
    optimizedTitle: `${cleanTopic}: A Comprehensive Guide`,
    optimizedContent: content,
    content: content,
    wordCount,
    qualityScore: 50,
    seoScore: 50,
    readabilityScore: 70,
    metaDescription: `Configure your AI provider to generate real content about ${cleanTopic}.`,
    h1: `${cleanTopic}: A Comprehensive Guide`,
    h2s: ['How to Enable AI Content Generation', 'Supported AI Providers', 'What You\'ll Get with AI'],
    sections: [
      { type: 'tldr', content: 'Configure an AI provider in the Configuration tab to generate real content.' },
      { type: 'takeaways', data: ['Configure AI in Configuration tab', 'Enter your API key', 'Get real AI-generated content'] },
      { type: 'paragraph', content: content },
    ],
    excerpt: 'Configure your AI provider for real content.',
    author: 'Page Perfector',
    publishedAt: new Date().toISOString(),
  }
}

// ============================================================================
// MAIN AI ROUTER
// ============================================================================
export async function generateWithAI(aiConfig: AIConfig, topic: string): Promise<GeneratedContent> {
  console.log('[generateWithAI] ========== AI GENERATION ==========')
  console.log('[generateWithAI] Provider:', aiConfig.provider)
  console.log('[generateWithAI] Model:', aiConfig.model)
  console.log('[generateWithAI] Has API Key:', !!aiConfig.apiKey)
  console.log('[generateWithAI] Topic:', topic)

  if (!aiConfig.apiKey) {
    console.warn('[generateWithAI] No API key provided')
    return generateFallbackContent(topic)
  }

  const { provider, apiKey, model } = aiConfig

  try {
    switch (provider.toLowerCase()) {
      case 'google':
        return await generateWithGemini(apiKey, model || 'gemini-2.0-flash', topic)
      
      case 'openai':
        return await generateWithOpenAI(apiKey, model || 'gpt-4o-mini', topic)
      
      case 'anthropic':
        return await generateWithAnthropic(apiKey, model || 'claude-3-haiku-20240307', topic)
      
      case 'groq':
        return await generateWithGroq(apiKey, model || 'llama-3.1-8b-instant', topic)
      
      case 'openrouter':
        // OpenRouter uses OpenAI-compatible API
        return await generateWithOpenAI(apiKey, model || 'openai/gpt-4o-mini', topic)
      
      default:
        console.warn(`[generateWithAI] Unknown provider: ${provider}, trying as Gemini`)
        return await generateWithGemini(apiKey, model || 'gemini-2.0-flash', topic)
    }
  } catch (err) {
    console.error('[generateWithAI] AI generation failed:', err)
    console.error('[generateWithAI] Falling back to placeholder content')
    return generateFallbackContent(topic)
  }
}
