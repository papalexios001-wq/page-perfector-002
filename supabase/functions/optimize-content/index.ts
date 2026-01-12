import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  let jobId: string | null = null;

  try {
    const body = await req.json();
    const url = body.url || '';
    const postTitle = body.postTitle || url;

    console.log('[optimize] Starting for:', postTitle);

    // Create job
    jobId = crypto.randomUUID();
    await supabaseClient.from('jobs').insert({
      id: jobId,
      status: 'running',
      progress: 5,
      current_step: 'Starting...',
      created_at: new Date().toISOString(),
    });

    // Process WITHOUT EdgeRuntime.waitUntil (the bug!)
    processInBackground(supabaseClient, jobId, postTitle);

    return new Response(
      JSON.stringify({ success: true, jobId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[optimize] Error:', err);
    if (jobId) {
      await supabaseClient.from('jobs').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      }).eq('id', jobId);
    }
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Process without awaiting - runs in background
function processInBackground(supabase: any, jobId: string, title: string) {
  processJob(supabase, jobId, title).catch(async (err) => {
    console.error('[optimize] Background error:', err);
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Failed',
    }).eq('id', jobId);
  });
}

async function processJob(supabase: any, jobId: string, title: string) {
  const update = async (progress: number, step: string) => {
    await supabase.from('jobs').update({
      progress,
      current_step: step,
    }).eq('id', jobId);
  };

  await update(20, 'Analyzing...');
  await delay(500);

  await update(40, 'Generating content...');
  
  // Generate content
  const result = {
    title: title,
    optimizedContent: `<h1>${title}</h1><p>Optimized content here.</p>`,
    wordCount: 500,
    qualityScore: 85,
    sections: [
      { type: 'heading', content: title },
      { type: 'paragraph', content: 'This is optimized content.' }
    ]
  };

  await update(80, 'Finalizing...');

  await supabase.from('jobs').update({
    status: 'completed',
    progress: 100,
    current_step: 'Complete!',
    result,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);

  console.log('[optimize] Done!');
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
