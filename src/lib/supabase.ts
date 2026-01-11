import { supabase } from '@/integrations/supabase/client';

// Re-export the supabase client
export { supabase };

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
};

// Get edge function URL
export const getEdgeFunctionUrl = (functionName: string): string => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('Backend runtime not configured. Please connect Lovable Cloud first.');
  }
  return `${url}/functions/v1/${functionName}`;
};

// Enterprise-grade edge function invocation
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

// NEW: Support object-based invocation format
export interface InvokeEdgeFunctionParams {
  functionName: string;
  body: Record<string, unknown>;
  options?: InvokeOptions;
}

export async function invokeEdgeFunction<T = unknown>(
  paramsOrFunctionName: InvokeEdgeFunctionParams | string,
  bodyOrOptions?: Record<string, unknown> | InvokeOptions,
  legacyOptions?: InvokeOptions
): Promise<EdgeFunctionResult<T>> {
  
  // Handle both calling conventions:
  // 1. invokeEdgeFunction({ functionName, body, options })
  // 2. invokeEdgeFunction(functionName, body, options)
  let functionName: string;
  let body: Record<string, unknown>;
  let options: InvokeOptions | undefined;

  if (typeof paramsOrFunctionName === 'object' && 'functionName' in paramsOrFunctionName) {
    // Object-based invocation
    functionName = paramsOrFunctionName.functionName;
    body = paramsOrFunctionName.body;
    options = paramsOrFunctionName.options;
    console.log('[invokeEdgeFunction] Using object-based invocation for:', functionName);
  } else if (typeof paramsOrFunctionName === 'string') {
    // Legacy positional arguments
    functionName = paramsOrFunctionName;
    body = (bodyOrOptions as Record<string, unknown>) || {};
    options = legacyOptions;
    console.log('[invokeEdgeFunction] Using legacy invocation for:', functionName);
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

  console.log('[invokeEdgeFunction] Calling:', functionName, 'with body:', JSON.stringify(body));

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

  // Setup timeout with AbortController
  const timeoutMs = options?.timeoutMs ?? 120000; // 120 second default for AI operations
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[invokeEdgeFunction] Timeout after ${timeoutMs}ms for ${functionName}`);
    controller.abort();
  }, timeoutMs);

  // Combine with any provided signal
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    console.log('[invokeEdgeFunction] Making Supabase function call...');
    
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

    console.log('[invokeEdgeFunction] Success! Data received:', JSON.stringify(data).slice(0, 500));
    return { data: data as T, error: null };
    
  } catch (err) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`[invokeEdgeFunction] Timeout for ${functionName} after ${timeoutMs}ms`);
      return {
        data: null,
        error: {
          message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
          code: 'TIMEOUT_ERROR',
        },
      };
    }

    console.error(`[invokeEdgeFunction] Exception calling ${functionName}:`, err);
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}
