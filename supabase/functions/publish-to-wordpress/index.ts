// supabase/functions/publish-to-wordpress/index.ts
// ============================================================================
// WORDPRESS PUBLISHING EDGE FUNCTION v3.0
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PublishRequest {
  pageId: string;
  jobId?: string;
  title: string;
  content: string;
  status: 'draft' | 'publish';
  siteUrl?: string;
  username?: string;
  applicationPassword?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: PublishRequest = await req.json();
    
    console.log('[publish-to-wordpress] Request received');
    console.log('[publish-to-wordpress] PageId:', body.pageId);
    console.log('[publish-to-wordpress] Status:', body.status);
    console.log('[publish-to-wordpress] Title:', body.title?.slice(0, 50));
    console.log('[publish-to-wordpress] Content length:', body.content?.length || 0);

    // Validate required fields
    if (!body.pageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'pageId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!body.content || body.content.length < 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is too short or missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get WordPress credentials
    let wpUrl = body.siteUrl;
    let wpUsername = body.username;
    let wpPassword = body.applicationPassword;

    // If not provided, fetch from database
    if (!wpUrl || !wpUsername || !wpPassword) {
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .limit(1)
        .single();

      if (sitesError || !sites) {
        console.error('[publish-to-wordpress] No site configured:', sitesError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'WordPress site not configured. Please add credentials in Configuration tab.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      wpUrl = sites.wp_url;
      wpUsername = sites.wp_username;
      wpPassword = sites.wp_app_password;
    }

    // Validate WordPress credentials
    if (!wpUrl || !wpUsername || !wpPassword) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WordPress credentials incomplete. URL, username, and application password required.' 
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

    // Create the post via WordPress REST API
    const endpoint = `${normalizedUrl}/wp-json/wp/v2/posts`;
    const authHeader = 'Basic ' + btoa(`${wpUsername}:${wpPassword}`);

    const postData = {
      title: body.title || 'Optimized Post',
      content: body.content,
      status: body.status || 'draft',
    };

    console.log('[publish-to-wordpress] Creating post...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'PagePerfector/1.0',
      },
      body: JSON.stringify(postData),
    });

    const responseText = await response.text();
    console.log('[publish-to-wordpress] Response status:', response.status);
    console.log('[publish-to-wordpress] Response:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error('[publish-to-wordpress] WordPress API error:', response.status, responseText);
      
      // Parse error message
      let errorMessage = `WordPress API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.code || errorMessage;
      } catch {
        // Use default error message
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    let wpPost;
    try {
      wpPost = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from WordPress' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[publish-to-wordpress] Post created:', wpPost.id, wpPost.link);

    // Update page record with WordPress post ID
    await supabase.from('pages').update({
      post_id: wpPost.id,
      status: body.status === 'publish' ? 'published' : 'draft',
      updated_at: new Date().toISOString(),
    }).eq('id', body.pageId);

    return new Response(
      JSON.stringify({
        success: true,
        postId: wpPost.id,
        postUrl: wpPost.link,
        status: body.status,
        message: `Post ${body.status === 'publish' ? 'published' : 'saved as draft'} successfully`,
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
