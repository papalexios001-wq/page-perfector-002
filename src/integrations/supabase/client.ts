import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ SUPABASE NOT CONFIGURED!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ MISSING');
  console.error('VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseAnonKey ? '✓' : '✗ MISSING');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
