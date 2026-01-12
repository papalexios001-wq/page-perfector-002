// ============================================================================
// SUPABASE UTILITIES - ENTERPRISE-GRADE EDGE FUNCTION INVOCATION
// Version: 2.0.0 - SOTA Production Ready
// ============================================================================

import { supabase, isConfigured } from '@/integrations/supabase/client';

// Re-export for convenience
export { supabase };

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

export const isSupabaseConfigured = (): boolean => {
  return isConfigured;
};

// ============================================================================
// TYPES
// ============================================================================

export interface EdgeFunctionResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string; details?: unknown } | null;
}

export interface EdgeFunctionOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

// ============================================================================
// EDGE FUNCTION INVOCATION
// ============================================================================

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResult<T>> {
  const { retries = 0, retryDelay = 1000 } = options;
  
  console.log(`[invokeEdgeFunction] Calling: ${functionName}`);
  console.log(`[invokeEdgeFunction] Body:`, JSON.stringify(body).slice(0, 200));

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.error('[invokeEdgeFunction] Supabase not configured!');
    return {
      data: null,
      error: {
        message: 'Supabase not configured. Please check your environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).',
        code: 'NOT_CONFIGURED',
      },
    };
  }

  // Verify supabase client exists and has functions
  if (!supabase?.functions?.invoke) {
    console.error('[invokeEdgeFunction] Supabase client not properly initialized');
    return {
      data: null,
      error: {
        message: 'Supabase client not properly initialized. The functions.invoke method is not available.',
        code: 'CLIENT_ERROR',
      },
    };
  }

  let lastError: EdgeFunctionResult<T>['error'] = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[invokeEdgeFunction] Retry attempt ${attempt}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }

      console.log(`[invokeEdgeFunction] Invoking ${functionName}...`);
      
      const response = await supabase.functions.invoke(functionName, {
        body: body,
      });

      console.log(`[invokeEdgeFunction] Raw response received`);

      // Check for error in response
      if (response.error) {
        console.error(`[invokeEdgeFunction] Error from Supabase:`, response.error);
        
        lastError = {
          message: response.error.message || 'Edge function error',
          code: 'EDGE_FUNCTION_ERROR',
          details: response.error,
        };
        
        // Don't retry on authentication errors
        if (response.error.message?.includes('401') || 
            response.error.message?.includes('403') ||
            response.error.message?.includes('not found')) {
          break;
        }
        
        continue;
      }

      // Validate response data
      if (response.data === undefined) {
        console.warn('[invokeEdgeFunction] Response data is undefined');
        return {
          data: null as T,
          error: null,
        };
      }

      console.log(`[invokeEdgeFunction] Success!`);
      return {
        data: response.data as T,
        error: null,
      };

    } catch (err) {
      console.error(`[invokeEdgeFunction] Exception on attempt ${attempt}:`, err);
      
      lastError = {
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        code: 'EXCEPTION',
        details: err,
      };
    }
  }

  return {
    data: null,
    error: lastError || {
      message: 'Failed to invoke edge function after all retries',
      code: 'MAX_RETRIES_EXCEEDED',
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function checkSupabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('jobs').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function getSupabaseStatus(): {
  configured: boolean;
  url: string;
  hasKey: boolean;
} {
  return {
    configured: isSupabaseConfigured(),
    url: import.meta.env.VITE_SUPABASE_URL || 'NOT SET',
    hasKey: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  };
}
