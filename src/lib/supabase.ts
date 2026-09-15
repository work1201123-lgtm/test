import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from './db';

// Supabase is configured via VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// (.env.local). When both are present we talk to your Supabase project;
// otherwise we fall back to the local-first db (localStorage + demo seed).
// Both expose the same from()/rpc() surface App.tsx uses, so App.tsx
// stays untouched.

function supabaseEnv(): { url: string; key: string } | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
    const url = env.VITE_SUPABASE_URL?.trim();
    const key = env.VITE_SUPABASE_ANON_KEY?.trim();
    if (url && key) return { url, key };
  } catch {
    /* env unavailable */
  }
  return null;
}

const env = supabaseEnv();

let client: SupabaseClient | null = null;
if (env) {
  try {
    client = createClient(env.url, env.key);
  } catch {
    client = null;
  }
}

/** True when the app is actually talking to Supabase (not localStorage). */
export const isOnlineDb = client !== null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryApi = { from: (table: any) => any; rpc: (fn: string, args?: any) => any };

export const supabase = ((client ?? db) as unknown) as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: any) => Promise<{ data: unknown; error: { message: string } | null }>;
} & QueryApi & { auth?: SupabaseClient['auth'] };
