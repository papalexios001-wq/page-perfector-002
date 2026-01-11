// src/integrations/supabase/client.ts
// ============================================================================
// SUPABASE CLIENT - Properly configured client
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'x-client-info': 'page-perfector/1.0',
      },
    },
  }
);

// Helper to invoke edge functions with proper error handling
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: any
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      console.error(`[${functionName}] Edge function error:`, error);
      return { data: null, error: new Error(error.message || 'Edge function failed') };
    }

    return { data, error: null };
  } catch (err) {
    console.error(`[${functionName}] Exception:`, err);
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error('Unknown error') 
    };
  }
}

export default supabase;
