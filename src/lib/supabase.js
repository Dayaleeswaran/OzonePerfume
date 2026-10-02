import { createClient } from '@supabase/supabase-js';

/* Only the public URL and anon key belong in the browser. The anon key is safe to expose because
   every table is protected by row-level security; secrets (service role, payment keys) live
   exclusively in Supabase Edge Function secrets — never in VITE_* variables. */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
});
