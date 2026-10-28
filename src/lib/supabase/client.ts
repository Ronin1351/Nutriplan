import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AppSupabaseClient = SupabaseClient;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));
}

export function getSupabaseClient(): AppSupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  return createClient(url, anonKey);
}

export async function unwrapSupabase<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  operation: string,
): Promise<T> {
  const { data, error } = await request;

  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }

  if (data === null) {
    throw new Error(`${operation}: Supabase returned no data.`);
  }

  return data;
}
