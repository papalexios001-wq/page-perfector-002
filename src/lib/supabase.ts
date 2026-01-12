import { supabase } from '@/integrations/supabase/client';

export { supabase };

export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
};

export interface EdgeFunctionResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<EdgeFunctionResult<T>> {
  
  console.log('[invokeEdgeFunction] Calling:', functionName);

  // Check configuration
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: { message: 'Supabase not configured. Check environment variables.', code: 'NOT_CONFIGURED' },
    };
  }

  // CRITICAL: Check if supabase.functions exists
  if (!supabase || !supabase.functions || typeof supabase.functions.invoke !== 'function') {
    console.error('[invokeEdgeFunction] supabase.functions.invoke is not available!');
    console.error('[invokeEdgeFunction] supabase:', typeof supabase);
    console.error('[invokeEdgeFunction] supabase.functions:', typeof supabase?.functions);
    return {
      data: null,
      error: { message: 'Supabase client not initialized correctly.', code: 'CLIENT_ERROR' },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) {
      console.error('[invokeEdgeFunction] Error:', error);
      return { data: null, error: { message: error.message || 'Edge function error' } };
    }

    console.log('[invokeEdgeFunction] Success');
    return { data: data as T, error: null };
  } catch (err) {
    console.error('[invokeEdgeFunction] Exception:', err);
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}
