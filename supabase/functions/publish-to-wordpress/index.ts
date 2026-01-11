// supabase/functions/publish-to-wordpress/index.ts
// ============================================================================
// WORDPRESS PUBLISHING - Fixed version with proper error handling
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    
    console.log('[publish-to-wordpress] Request received');
    console.log('[publish-to-wordpress] Title:', body.title?.slice(0, 50));
    console.log('[publish-to-wordpress] Content length:', body.content?.length || 0);
    console.log('[publish-to-wordpress] Status:', body.status);

    // Validate content
    if (!body.content || body.content.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is too short or missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get WordPress credentials
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .limit(1)
      .single();

    if (sitesError || !sites) {
      console.error('[publish-to-wordpress] No site configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WordPress site not configured. Add credentials in Configuration tab.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const wpUrl = sites.wp_url;
    const wpUsername = sites.wp_username;
    const wpPassword = sites.wp_app_password;

    if (!wpUrl || !wpUsername || !wpPassword) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WordPress credentials incomplete' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = wpUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    console.log('[publish-to-wordpress] WordPress URL:', normalizedUrl);

    // Create the post
    const endpoint = `${normalizedUrl}/wp-json/wp/v2/posts`;
    const authHeader = 'Basic ' + btoa(`${wpUsername}:${wpPassword}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'PagePerfector/1.0',
      },
      body: JSON.stringify({
        title: body.title || 'Optimized Post',
        content: body.content,
        status: body.status || 'draft',
      }),
    });

    const responseText = await response.text();
    console.log('[publish-to-wordpress] Response:', response.status);

    if (!response.ok) {
      let errorMessage = `WordPress API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.code || errorMessage;
      } catch {}

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    const wpPost = JSON.parse(responseText);
    console.log('[publish-to-wordpress] Created post:', wpPost.id);

    // Update page record
    if (body.pageId) {
      await supabase.from('pages').update({
        post_id: wpPost.id,
        status: body.status === 'publish' ? 'published' : 'draft',
        updated_at: new Date().toISOString(),
      }).eq('id', body.pageId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        postId: wpPost.id,
        postUrl: wpPost.link,
        status: body.status,
        message: `Post ${body.status === 'publish' ? 'published' : 'saved as draft'}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[publish-to-wordpress] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
