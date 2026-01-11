// supabase/functions/publish-to-wordpress/index.ts
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    const body = await req.json();
    
    if (!body.content || body.content.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content too short' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get WordPress credentials
    const { data: sites } = await supabase
      .from('sites')
      .select('*')
      .limit(1)
      .single();

    if (!sites?.wp_url || !sites?.wp_username || !sites?.wp_app_password) {
      return new Response(
        JSON.stringify({ success: false, error: 'WordPress not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let wpUrl = sites.wp_url.trim();
    if (!wpUrl.startsWith('http')) wpUrl = 'https://' + wpUrl;
    wpUrl = wpUrl.replace(/\/+$/, '');

    const auth = btoa(`${sites.wp_username}:${sites.wp_app_password}`);

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: body.title || 'Optimized Post',
        content: body.content,
        status: body.status || 'draft',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(
        JSON.stringify({ success: false, error: `WordPress error: ${res.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status }
      );
    }

    const post = await res.json();

    return new Response(
      JSON.stringify({ success: true, postId: post.id, postUrl: post.link }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
