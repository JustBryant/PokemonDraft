import { createClient } from '@supabase/supabase-js';

// If you have a real Supabase URL and Key, replace these placeholders.
// Otherwise, the app will fall back to LocalStorage mode to prevent CORS errors.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder-url.supabase.co');

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
