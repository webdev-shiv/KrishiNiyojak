import { createClient } from '@supabase/supabase-js';

// Read configuration strictly from environment variables per project standards
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const _isConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('YOUR-PROJECT') &&
  supabaseUrl.startsWith('http')
);

// Export callable function that also coerces to boolean primitive
export const isSupabaseConfigured = _isConfigured;

if (!_isConfigured) {
  console.warn(
    '[Supabase Configuration Warning] VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY are missing or unconfigured. ' +
    'The application requires live Supabase credentials to access business data. ' +
    'Silent demo fallbacks are disabled in compliance with data integrity policies.'
  );
}

// Create single reusable client instance safely without throwing
let client = null;
if (_isConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase Configuration Warning] Could not initialize client:', err);
    client = null;
  }
}

export const supabase = client;
export default supabase;

