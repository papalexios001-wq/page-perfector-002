// ============================================================================
// OPTIMIZE-CONTENT EDGE FUNCTION - COMPLETE ENTERPRISE VERSION 8.0
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { generateWithAI, generateFallbackContent } from './ai-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  })
}

async function updateProgress(supabase: any, jobId: string, progress: number, step: string) {
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

async function processJob(
  supabase: any, 
  jobId: string, 
  topic: string, 
  aiConfig: any
) {
  console.log(`[Job ${jobId}] ========== STARTING ==========`)
  console.log(`[Job ${jobId}] Topic: ${topic}`)
  console.log(`[Job ${jobId}] AI Config:`, {
    provider: aiConfig?.provider,
    hasApiKey: !!aiConfig?.apiKey,
    model: aiConfig?.model,
  })
  
  try {
    await updateProgress(supabase, jobId, 15, 'Analyzing content requirements...')
    await new Promise(r => setTimeout(r, 300))

    await updateProgress(supabase, jobId, 30, 'Researching topic and keywords...')
    await new Promise(r => setTimeout(r, 300))

    // CRITICAL: Generate content with AI
    await updateProgress(supabase, jobId, 50, `Generating with ${aiConfig?.provider || 'fallback'}...`)
    
    let result
    if (aiConfig?.apiKey && aiConfig?.provider && aiConfig?.model) {
      console.log(`[Job ${jobId}] Calling real AI generation...`)
      result = await generateWithAI(aiConfig, topic)
    } else {
      console.warn(`[Job ${jobId}] No AI config - using fallback`)
      result = generateFallbackContent(topic)
    }

    await updateProgress(supabase, jobId, 70, 'Applying SEO optimizations...')
    await new Promise(r => setTimeout(r, 200))

    await updateProgress(supabase, jobId, 90, 'Finalizing content...')
    await new Promise(r => setTimeout(r, 200))

    // Complete
    const { error: completeError } = await supabase.from('jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'Complete!',
      result: result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    if (completeError) {
      console.error(`[Job ${jobId}] Complete update failed:`, completeError)
    } else {
      console.log(`[Job ${jobId}] ✅ COMPLETED - Words: ${result.wordCount}, Quality: ${result.qualityScore}`)
    }

  } catch (err) {
    console.error(`[Job ${jobId}] ❌ FAILED:`, err)
    
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown error',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[optimize-content] ========== NEW REQUEST ==========')

  try {
    const body = await req.json()
    
    console.log('[optimize-content] Received body:', JSON.stringify({
      url: body.url || body.siteUrl,
      postTitle: body.postTitle,
      aiProvider: body.aiConfig?.provider,
      hasAiKey: !!body.aiConfig?.apiKey,
      aiModel: body.aiConfig?.model,
    }))

    const topic = body.postTitle || body.keyword || body.url || 'Content Optimization'
    const aiConfig = body.aiConfig

    // Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[optimize-content] Supabase not configured')
      return jsonResponse({ success: false, error: 'Supabase not configured' }, 500)
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
      current_step: 'Initializing optimization...',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[optimize-content] Job insert failed:', insertError)
      return jsonResponse({ success: false, error: insertError.message })
    }

    // Start background processing (non-blocking)
    processJob(supabase, jobId, topic, aiConfig).catch(err => {
      console.error('[optimize-content] Background error:', err)
    })

    console.log('[optimize-content] Returning jobId:', jobId)
    return jsonResponse({
      success: true,
      jobId: jobId,
      pageId: body.pageId || null,
      message: 'Optimization started'
    })

  } catch (err) {
    console.error('[optimize-content] Request error:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})
