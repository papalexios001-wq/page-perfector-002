// ============================================================================
// ENTERPRISE-GRADE SUPABASE CLIENT - SOTA CONFIGURATION
// Robust initialization with comprehensive error handling
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Validation flags
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Log configuration status (only in development)
if (import.meta.env.DEV) {
  console.log('[Supabase Client] Configuration Status:');
  console.log('  VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ MISSING');
  console.log('  VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseAnonKey ? '✓ Set' : '✗ MISSING');
  console.log('  Is Configured:', isConfigured ? '✓ YES' : '✗ NO');
}

// ============================================================================
// CREATE SUPABASE CLIENT WITH PROPER OPTIONS
// ============================================================================
let supabase: SupabaseClient;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'wp-optimizer-pro-ultra',
      },
    },
  });
  
  if (import.meta.env.DEV) {
    console.log('[Supabase Client] ✓ Client created successfully');
  }
} catch (error) {
  console.error('[Supabase Client] ✗ Failed to create client:', error);
  // Create a minimal client that will fail gracefully
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

// ============================================================================
// EXPORTS
// ============================================================================
export { supabase, isConfigured };

// Type export for external use
export type { SupabaseClient };
