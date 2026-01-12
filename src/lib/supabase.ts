// ============================================================================
// ENTERPRISE-GRADE SUPABASE UTILITIES - SOTA EDGE FUNCTION INVOCATION
// Robust error handling, retry logic, and comprehensive logging
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
// EDGE FUNCTION INVOCATION - ENTERPRISE-GRADE
// ============================================================================
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResult<T>> {
  const { retries = 2, retryDelay = 1000, timeout = 30000 } = options;
  
  console.log(`[invokeEdgeFunction] Calling: ${functionName}`);
  console.log(`[invokeEdgeFunction] Body:`, JSON.stringify(body, null, 2));

  // ========================================================================
  // PRE-FLIGHT CHECKS
  // ========================================================================
  
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.error('[invokeEdgeFunction] Supabase not configured!');
    return {
      data: null,
      error: {
        message: 'Supabase not configured. Please check your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).',
        code: 'NOT_CONFIGURED',
      },
    };
  }

  // CRITICAL: Verify supabase.functions exists and is callable
  if (!supabase) {
    console.error('[invokeEdgeFunction] Supabase client is undefined!');
    return {
      data: null,
      error: {
        message: 'Supabase client is not initialized.',
        code: 'CLIENT_UNDEFINED',
      },
    };
  }

  if (!supabase.functions) {
    console.error('[invokeEdgeFunction] supabase.functions is undefined!');
    return {
      data: null,
      error: {
        message: 'Supabase functions module is not available. This may be a client initialization issue.',
        code: 'FUNCTIONS_UNDEFINED',
      },
    };
  }

  if (typeof supabase.functions.invoke !== 'function') {
    console.error('[invokeEdgeFunction] supabase.functions.invoke is not a function!');
    console.error('[invokeEdgeFunction] Type of invoke:', typeof supabase.functions.invoke);
    console.error('[invokeEdgeFunction] supabase.functions keys:', Object.keys(supabase.functions));
    return {
      data: null,
      error: {
        message: 'supabase.functions.invoke is not a function. The Supabase client may not be properly initialized.',
        code: 'INVOKE_NOT_FUNCTION',
      },
    };
  }

  // ========================================================================
  // INVOKE WITH RETRY LOGIC
  // ========================================================================
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[invokeEdgeFunction] Retry attempt ${attempt}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Invoke the edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      clearTimeout(timeoutId);

      // Handle Supabase error
      if (error) {
        console.error(`[invokeEdgeFunction] Supabase error:`, error);
        
        // Check if it's a retryable error
        const isRetryable = error.message?.includes('timeout') || 
                           error.message?.includes('network') ||
                           error.message?.includes('503') ||
                           error.message?.includes('502');
        
        if (isRetryable && attempt < retries) {
          lastError = new Error(error.message || 'Edge function error');
          continue;
        }
        
        return {
          data: null,
          error: {
            message: error.message || 'Edge function invocation failed',
            code: 'EDGE_FUNCTION_ERROR',
            details: error,
          },
        };
      }

      // Success!
      console.log(`[invokeEdgeFunction] Success! Response:`, data);
      return {
        data: data as T,
        error: null,
      };

    } catch (err) {
      console.error(`[invokeEdgeFunction] Exception on attempt ${attempt}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Check for abort (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        if (attempt < retries) continue;
        return {
          data: null,
          error: {
            message: `Request timed out after ${timeout}ms`,
            code: 'TIMEOUT',
          },
        };
      }
      
      // Continue to retry if we have attempts left
      if (attempt < retries) continue;
    }
  }

  // All retries exhausted
  return {
    data: null,
    error: {
      message: lastError?.message || 'All retry attempts failed',
      code: 'MAX_RETRIES_EXCEEDED',
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if the Supabase backend is reachable
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  try {
    const { error } = await supabase.from('jobs').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get the current Supabase configuration status
 */
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
