// src/lib/supabase.ts
// ENTERPRISE-GRADE EDGE FUNCTION INVOCATION WITH BULLETPROOF ERROR HANDLING

import { supabase } from '@/integrations/supabase/client';

export { supabase };

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !url.includes('placeholder'));
};

// Get edge function URL
export const getEdgeFunctionUrl = (functionName: string): string => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('Backend runtime not configured. Please connect Lovable Cloud first.');
  }
  return `${url}/functions/v1/${functionName}`;
};

// Type definitions
export interface EdgeFunctionResult<T = unknown> {
  data: T | null;
  error: EdgeFunctionError | null;
}

export interface EdgeFunctionError {
  message: string;
  code?: string;
  status?: number;
}

export interface InvokeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface InvokeEdgeFunctionParams {
  functionName: string;
  body: Record<string, unknown>;
  options?: InvokeOptions;
}

/**
 * ENTERPRISE-GRADE Edge Function Invocation
 * Supports both object-based and legacy positional argument patterns
 */
export async function invokeEdgeFunction<T = unknown>(
  paramsOrFunctionName: InvokeEdgeFunctionParams | string,
  bodyOrOptions?: Record<string, unknown> | InvokeOptions,
  legacyOptions?: InvokeOptions
): Promise<EdgeFunctionResult<T>> {
  
  let functionName: string;
  let body: Record<string, unknown>;
  let options: InvokeOptions | undefined;

  // Handle both calling conventions
  if (typeof paramsOrFunctionName === 'object' && 'functionName' in paramsOrFunctionName) {
    functionName = paramsOrFunctionName.functionName;
    body = paramsOrFunctionName.body;
    options = paramsOrFunctionName.options;
  } else if (typeof paramsOrFunctionName === 'string') {
    functionName = paramsOrFunctionName;
    body = (bodyOrOptions as Record<string, unknown>) || {};
    options = legacyOptions;
  } else {
    console.error('[invokeEdgeFunction] Invalid parameters:', paramsOrFunctionName);
    return {
      data: null,
      error: {
        message: 'Invalid function invocation parameters',
        code: 'INVALID_PARAMS',
      },
    };
  }

  console.log('[invokeEdgeFunction] Calling:', functionName);

  // Validate Supabase configuration
  if (!isSupabaseConfigured()) {
    console.error('[invokeEdgeFunction] Supabase not configured!');
    return {
      data: null,
      error: {
        message: 'Backend runtime not configured. Please connect Lovable Cloud to enable this feature.',
        code: 'BACKEND_NOT_CONFIGURED',
      },
    };
  }

  // Validate supabase.functions exists
  if (!supabase || typeof supabase.functions?.invoke !== 'function') {
    console.error('[invokeEdgeFunction] supabase.functions.invoke is not a function!');
    console.error('[invokeEdgeFunction] supabase:', supabase);
    console.error('[invokeEdgeFunction] supabase.functions:', supabase?.functions);
    return {
      data: null,
      error: {
        message: 'Supabase client not properly initialized. Please refresh the page.',
        code: 'CLIENT_NOT_INITIALIZED',
      },
    };
  }

  // Setup timeout
  const timeoutMs = options?.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[invokeEdgeFunction] Timeout after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error('[invokeEdgeFunction] Supabase error:', error);
      return {
        data: null,
        error: {
          message: error.message || 'Edge function error',
          code: 'EDGE_FUNCTION_ERROR',
          status: (error as any).status,
        },
      };
    }

    console.log('[invokeEdgeFunction] Success!');
    return { data: data as T, error: null };
    
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        data: null,
        error: {
          message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
          code: 'TIMEOUT_ERROR',
        },
      };
    }

    console.error(`[invokeEdgeFunction] Exception:`, err);
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}
