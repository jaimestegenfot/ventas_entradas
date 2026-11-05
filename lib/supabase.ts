import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function obtenerConexionSupabase() {
  const url = process.env.SUPABASE_URL;
  const claveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !claveSecreta)
    throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local');
  return createClient(url, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
