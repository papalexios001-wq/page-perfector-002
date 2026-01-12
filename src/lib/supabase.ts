// ============================================================================
// SUPABASE UTILITIES - EDGE FUNCTION INVOCATION
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
  console.log(`[invokeEdgeFunction] Calling: ${functionName}`);
  console.log(`[invokeEdgeFunction] Body:`, body);

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.error('[invokeEdgeFunction] Supabase not configured!');
    return {
      data: null,
      error: {
        message: 'Supabase not configured. Please check your environment variables.',
        code: 'NOT_CONFIGURED',
      },
    };
  }

  // Verify supabase client exists
  if (!supabase || !supabase.functions || typeof supabase.functions.invoke !== 'function') {
    console.error('[invokeEdgeFunction] Supabase client not properly initialized');
    return {
      data: null,
      error: {
        message: 'Supabase client not properly initialized.',
        code: 'CLIENT_ERROR',
      },
    };
  }

  try {
    console.log(`[invokeEdgeFunction] Invoking ${functionName}...`);
    
    // Call the edge function
    const response = await supabase.functions.invoke(functionName, {
      body: body,
    });

    console.log(`[invokeEdgeFunction] Raw response:`, response);

    // Check for error in response
    if (response.error) {
      console.error(`[invokeEdgeFunction] Error from Supabase:`, response.error);
      
      // The error might contain the actual response data
      // Supabase treats non-2xx as errors but the body might still be useful
      const errorMessage = response.error.message || 'Edge function error';
      
      return {
        data: null,
        error: {
          message: errorMessage,
          code: 'EDGE_FUNCTION_ERROR',
          details: response.error,
        },
      };
    }

    // Success!
    console.log(`[invokeEdgeFunction] Success! Data:`, response.data);
    return {
      data: response.data as T,
      error: null,
    };

  } catch (err) {
    console.error(`[invokeEdgeFunction] Exception:`, err);
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: 'EXCEPTION',
        details: err,
      },
    };
  }
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
