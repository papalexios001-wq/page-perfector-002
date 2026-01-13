// ============================================================================
// PUBLISH TO WORDPRESS - ENTERPRISE SOTA v2.1.0
// Fixed: Better error handling, debugging, and WordPress API support
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
// HELPER: Error Response with Details
// ============================================================================

function errorResponse(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  status = 400
): Response {
  console.error(`[publish-to-wordpress] ERROR: ${code} - ${message}`, details)
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
// MAIN HANDLER
// ============================================================================

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[publish-to-wordpress] ========== NEW REQUEST ==========')
  console.log('[publish-to-wordpress] Timestamp:', new Date().toISOString())

  try {
    const body = await req.json()
    
    console.log('[publish-to-wordpress] Request body keys:', Object.keys(body))
    console.log('[publish-to-wordpress] Title:', body.title?.slice(0, 50))
    console.log('[publish-to-wordpress] Content length:', body.content?.length || 0)
    console.log('[publish-to-wordpress] Status:', body.status)
    console.log('[publish-to-wordpress] Post ID (for update):', body.postId)

    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!body.content || body.content.length < 50) {
      return errorResponse(
        'CONTENT_TOO_SHORT',
        'Content must be at least 50 characters long.',
        { contentLength: body.content?.length || 0 }
      )
    }

    if (!body.title || body.title.trim().length === 0) {
      return errorResponse(
        'TITLE_MISSING',
        'A title is required to publish the post.',
        {}
      )
    }

    // ========================================================================
    // GET WORDPRESS CREDENTIALS
    // ========================================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return errorResponse(
        'SERVER_CONFIG_ERROR',
        'Server configuration error. Please contact support.',
        {},
        500
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    // Try to get WordPress config from the request body first, then from database
    let wpUrl = body.wpUrl || body.siteUrl
    let wpUsername = body.wpUsername || body.username
    let wpPassword = body.wpPassword || body.applicationPassword || body.appPassword

    // If not in request body, get from database
    if (!wpUrl || !wpUsername || !wpPassword) {
      console.log('[publish-to-wordpress] Fetching WordPress credentials from database...')
      
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .limit(1)
        .single()

      if (sitesError) {
        console.error('[publish-to-wordpress] Database error:', sitesError)
        return errorResponse(
          'DATABASE_ERROR',
          'Failed to fetch WordPress configuration from database.',
          { error: sitesError.message },
          500
        )
      }

      if (!sites) {
        return errorResponse(
          'WORDPRESS_NOT_CONFIGURED',
          'No WordPress site configured. Go to Configuration → WordPress to set up your site.',
          { fix: 'Configure WordPress in the Configuration tab' }
        )
      }

      wpUrl = sites.wp_url
      wpUsername = sites.wp_username
      wpPassword = sites.wp_app_password

      console.log('[publish-to-wordpress] Found site:', wpUrl)
    }

    // Validate WordPress credentials
    if (!wpUrl || !wpUsername || !wpPassword) {
      return errorResponse(
        'WORDPRESS_CREDENTIALS_MISSING',
        'WordPress URL, username, or application password is missing.',
        {
          hasUrl: !!wpUrl,
          hasUsername: !!wpUsername,
          hasPassword: !!wpPassword,
          fix: 'Go to Configuration → WordPress → Enter all required fields',
        }
      )
    }

    // Normalize WordPress URL
    wpUrl = wpUrl.trim()
    if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
      wpUrl = 'https://' + wpUrl
    }
    wpUrl = wpUrl.replace(/\/+$/, '') // Remove trailing slashes

    console.log('[publish-to-wordpress] WordPress URL:', wpUrl)
    console.log('[publish-to-wordpress] Username:', wpUsername)
    console.log('[publish-to-wordpress] Password length:', wpPassword?.length || 0)

    // ========================================================================
    // PREPARE WORDPRESS API REQUEST
    // ========================================================================

    const auth = btoa(`${wpUsername}:${wpPassword}`)
    const isUpdate = !!body.postId
    
    const apiUrl = isUpdate 
      ? `${wpUrl}/wp-json/wp/v2/posts/${body.postId}`
      : `${wpUrl}/wp-json/wp/v2/posts`
    
    const method = isUpdate ? 'PUT' : 'POST'

    // Build post data
    const postData: Record<string, unknown> = {
      title: body.title,
      content: body.content,
      status: body.status || 'draft',
    }

    // Add optional fields if provided
    if (body.excerpt) {
      postData.excerpt = body.excerpt
    }
    if (body.slug) {
      postData.slug = body.slug
    }
    if (body.categories && Array.isArray(body.categories)) {
      postData.categories = body.categories
    }
    if (body.tags && Array.isArray(body.tags)) {
      postData.tags = body.tags
    }
    if (body.featuredMediaId) {
      postData.featured_media = body.featuredMediaId
    }

    // Add meta fields for SEO plugins (Yoast, RankMath, etc.)
    if (body.metaDescription || body.focusKeyword) {
      postData.meta = {
        // Yoast SEO
        _yoast_wpseo_metadesc: body.metaDescription || '',
        _yoast_wpseo_focuskw: body.focusKeyword || '',
        // RankMath
        rank_math_description: body.metaDescription || '',
        rank_math_focus_keyword: body.focusKeyword || '',
      }
    }

    console.log('[publish-to-wordpress] API URL:', apiUrl)
    console.log('[publish-to-wordpress] Method:', method)
    console.log('[publish-to-wordpress] Post status:', postData.status)

    // ========================================================================
    // CALL WORDPRESS API
    // ========================================================================

    const wpResponse = await fetch(apiUrl, {
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(postData),
    })

    console.log('[publish-to-wordpress] WordPress response status:', wpResponse.status)

    // ========================================================================
    // HANDLE WORDPRESS RESPONSE
    // ========================================================================

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text()
      console.error('[publish-to-wordpress] WordPress error response:', errorText)

      let errorMessage = `WordPress API returned status ${wpResponse.status}`
      let errorCode = 'WORDPRESS_API_ERROR'
      let fix = 'Check your WordPress configuration'

      // Parse specific error types
      if (wpResponse.status === 401) {
        errorCode = 'WORDPRESS_AUTH_FAILED'
        errorMessage = 'WordPress authentication failed. Check your username and application password.'
        fix = 'Go to Configuration → WordPress → Verify username and regenerate Application Password'
      } else if (wpResponse.status === 403) {
        errorCode = 'WORDPRESS_FORBIDDEN'
        errorMessage = 'Access denied. Your user may not have permission to create/edit posts.'
        fix = 'Ensure your WordPress user has Editor or Administrator role'
      } else if (wpResponse.status === 404) {
        errorCode = 'WORDPRESS_API_NOT_FOUND'
        errorMessage = 'WordPress REST API not found. Make sure REST API is enabled.'
        fix = 'Check if /wp-json/wp/v2/posts is accessible on your site'
      } else if (wpResponse.status === 500) {
        errorCode = 'WORDPRESS_SERVER_ERROR'
        errorMessage = 'WordPress server error. There may be a plugin conflict or server issue.'
        fix = 'Check your WordPress error logs and disable conflicting plugins'
      }

      // Try to parse JSON error for more details
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message) {
          errorMessage += ` - ${errorJson.message}`
        }
        if (errorJson.code) {
          errorCode = `WORDPRESS_${errorJson.code.toUpperCase()}`
        }
      } catch {
        // Not JSON, use text as is
      }

      return errorResponse(
        errorCode,
        errorMessage,
        {
          httpStatus: wpResponse.status,
          rawError: errorText.slice(0, 500),
          fix,
          apiUrl,
        },
        wpResponse.status >= 500 ? 502 : 400
      )
    }

    // ========================================================================
    // SUCCESS
    // ========================================================================

    const post = await wpResponse.json()

    console.log('[publish-to-wordpress] ✅ SUCCESS!')
    console.log('[publish-to-wordpress] Post ID:', post.id)
    console.log('[publish-to-wordpress] Post URL:', post.link)
    console.log('[publish-to-wordpress] Status:', post.status)

    return jsonResponse({
      success: true,
      message: isUpdate ? 'Post updated successfully!' : 'Post published successfully!',
      postId: post.id,
      postUrl: post.link,
      editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
      status: post.status,
      title: post.title?.rendered || body.title,
    })

  } catch (err) {
    console.error('[publish-to-wordpress] Unexpected error:', err)
    return errorResponse(
      'UNEXPECTED_ERROR',
      err instanceof Error ? err.message : 'An unexpected error occurred',
      { stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined },
      500
    )
  }
})
