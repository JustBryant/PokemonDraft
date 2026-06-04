import { createClient } from '@supabase/supabase-js';

// Robustly clean the URL to prevent common configuration mistakes
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
if (supabaseUrl.includes('/rest/v1')) {
  supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}
// Remove trailing slashes
supabaseUrl = supabaseUrl.replace(/\/+$/, '');

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder-url.supabase.co' &&
  supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// SILENT DATABASE LAYER (Does nothing if Supabase isn't real)
export const db = {
  get: async (table, id) => {
    if (!isSupabaseConfigured) return { data: null, error: null };
    try {
      return await supabase.from(table).select('*').eq('id', id).single();
    } catch (e) { return { data: null, error: e }; }
  },
  update: async (table, id, updates) => {
    if (!isSupabaseConfigured) return { data: null, error: null };
    try {
      return await supabase.from(table).update(updates).eq('id', id);
    } catch (e) { return { data: null, error: e }; }
  },
  insert: async (table, record) => {
    if (!isSupabaseConfigured) return { data: null, error: null };
    try {
      return await supabase.from(table).insert([record]);
    } catch (e) { return { data: null, error: e }; }
  }
};
